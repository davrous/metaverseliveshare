/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

// Ressources
// https://learn.microsoft.com/en-us/microsoftteams/platform/apps-in-teams-meetings/meeting-apps-apis?tabs=dotnet#share-app-content-to-stage-api
// https://doc.babylonjs.com/setup/starterHTML
// https://learn.microsoft.com/en-us/microsoftteams/platform/apps-in-teams-meetings/teams-live-share-overview?tabs=javascript 

import { SharedMap } from "fluid-framework";
import { LivePresence, LiveShareClient, TestLiveShareHost, PresenceState } from "@microsoft/live-share";
import { app, pages, meeting, LiveShareHost } from "@microsoft/teams-js";
import * as microsoftTeams from "@microsoft/teams-js";

const searchParams = new URL(window.location).searchParams;
const root = document.getElementById("content");
// every x milliseconds, we'll send an update of the current
// camera positions & rotations
const updateFrequencies = 100;
const framesToCompensate = 1 + updateFrequencies / (1000 / 60);

// Define container schema
const userDetails = "user-details";

let presence;

// Using LivePresence object to share avatar states
// https://learn.microsoft.com/en-us/microsoftteams/platform/apps-in-teams-meetings/teams-live-share-capabilities?tabs=javascript#livepresence-example
const containerSchema = {
    initialObjects: {
        presence: LivePresence,
    },
};

// Teams-js Context object
let context;
// Details about the current user
let defaultAvatarInformation;
let userPrincipalName;
let name;
// list of current users connected
let users = [];

// STARTUP LOGIC
async function start() {
    // Check for page to display
    let view = searchParams.get("view") || "stage";
    // Searching of a specified 3D scene in the query string
    let selected3DScene = searchParams.get("scene") || "default";

    // Check if we are running on stage.
    if (searchParams.get("inTeams")) {
        // Initialize teams app
        await app.initialize();

        // Get our frameContext from context of our app in Teams
        context = await app.getContext();
        console.log(
            `useTeamsContext: received context: ${JSON.stringify(
                context
            )}`
        );
        if (context.page.frameContext == "meetingStage") {
            view = "stage";
        }
    }
    // If not hosting in Teams, generating a random user ID for local tests
    else {
        context = {};
        context.user = {
            id: `user${Math.abs(Math.random() * 999999999)}`,
        };
    }

    defaultAvatarInformation = getRandomAvatar();
    userPrincipalName =
           context?.user.userPrincipalName ??
                `${defaultAvatarInformation.name}@contoso.com`;
    name = userPrincipalName.split("@")[0];

    console.log("userPrincipalName: " + userPrincipalName);
    console.log("name: " + name);

    // Load the requested view
    switch (view) {
        case "content":
            renderSideBar(root);
            break;
        case "config":
            renderSettings(root);
            break;
        case "stage":
        default:
            try {
                const { container } = await joinContainer();
                presence = container.initialObjects.presence;
            
                renderStage(root, presence, selected3DScene);
            } catch (error) {
                renderError(root, error);
            }
            break;
    }
}

async function joinContainer() {
    // Are we running in teams?
    const host = searchParams.get("inTeams")
        ? LiveShareHost.create()
        : TestLiveShareHost.create();

    // Create client
    const client = new LiveShareClient(host);

    // Join container
    return await client.joinContainer(containerSchema);
}

// STAGE VIEW
const stageTemplate = document.createElement("template");

stageTemplate["innerHTML"] = `
  <style>
    #renderCanvas {
        width: 100%;
        height: 100%;
        touch-action: none;
    }
  </style>
  <canvas id="renderCanvas"></canvas>
`;

function renderStage(elem, presence, selected3DScene) {
    elem.appendChild(stageTemplate.content.cloneNode(true));

    console.log("STAGE. Selected 3D scene: " + selected3DScene);

    let selectedSceneToRender = selected3DScene;
    let canvas = document.getElementById("renderCanvas");

    // Generate the BABYLON 3D engine
    // To know more: https://doc.babylonjs.com/setup/starterHTML
    const engine = new BABYLON.Engine(canvas, true, { disableWebGL2Support: true }); 

    // Creating a super simple avatar for the user made of
    // a cylinder acting as the body with a cube on top acting
    // as the head, textured on a single face with a profile picture
    const createAvatarBody = (initialSceneCameraPosition, userPresence, hdrTexture) => {
        let head, body;
        
        body = BABYLON.MeshBuilder.CreateCylinder("avatarBody",{height: 1, diameterBottom: 0.5, diameterTop: 0.15});
        body.position = initialSceneCameraPosition.clone();
        body.position.y -= 0.7;

        var plastic = new BABYLON.PBRMaterial("plastic", scene);
        plastic.reflectionTexture = hdrTexture;
        plastic.directIntensity = 0.6;
        plastic.environmentIntensity = 0.7;
        plastic.cameraExposure = 0.6;
        plastic.cameraContrast = 1.6;
        plastic.microSurface = 0.96;
        plastic.overloadedAlbedo = new BABYLON.Color3(0.206, 0.94, 1);
        plastic.overloadedAlbedoIntensity = 1;
        plastic.reflectivityColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        body.material = plastic;

        const headMat = new BABYLON.StandardMaterial("headMat");
        headMat.ambientTexture = new BABYLON.Texture(`src/assets/${userPresence.data.picture}`);
        headMat.ambientTexture.uScale = 4;

        // Used to texture only 1 of the face of the cube
        var faceUV = new Array(6);
        //set all values to zero
        for (var i = 0; i < 6; i++) {
            faceUV[i] = new BABYLON.Vector4(0, 0, 0, 0);
        }
        //rear face
        faceUV[0] = new BABYLON.Vector4(0.5, 0.0, 0.75, 1.0); 

        head = BABYLON.MeshBuilder.CreateBox("avatarHead", { size: 0.25, faceUV: faceUV, wrap: true});
        head.position = body.position.clone();
        head.position.y = 1.4;
        head.material = headMat;

        return { head: head, body: body}
    };

    // Creating a label on top of the cube with the name of the user
    // This label can be seen through walls to easily see where 
    // another user is in the scene
    const createLabelForAvatar = (avatar, userPresence, advancedTexture) => {
        console.log("Creating label for avatar: " + userPresence.data.name);
        var rect = new BABYLON.GUI.Rectangle();
        rect.width = 0.2;
        rect.height = "40px";
        rect.cornerRadius = 20;
        rect.color = "white";
        rect.thickness = 4;
        rect.background = "black";
        advancedTexture.addControl(rect);
    
        var label = new BABYLON.GUI.TextBlock();
        label.text = userPresence.data.name;
        rect.addControl(label);
    
        rect.linkWithMesh(avatar.head);   
        rect.linkOffsetY = -50;

        return rect;
    };

    const updateAvatarPositionAndRotation = (userPresence) => {
        // interpolating values from previous position to new one sent over websocket
        // to create a smooth animation. We should get a new position every 100 ms
        // which is approx 7 frames missing at 60 fps. 
        BABYLON.Animation.CreateAndStartAnimation("avatarpos", 
        users[userPresence.userId].body, 
        "position", 60, framesToCompensate, 
        users[userPresence.userId].body.position, 
        new BABYLON.Vector3(userPresence.data.cameraPosition._x, userPresence.data.cameraPosition._y - 0.7, userPresence.data.cameraPosition._z), 0);

        BABYLON.Animation.CreateAndStartAnimation("avatarpos", 
                        users[userPresence.userId].head, 
                        "position", 60, framesToCompensate, 
                        users[userPresence.userId].head.position, 
                        new BABYLON.Vector3(userPresence.data.cameraPosition._x, userPresence.data.cameraPosition._y, userPresence.data.cameraPosition._z), 0);
    
        BABYLON.Animation.CreateAndStartAnimation("camerarot", 
            users[userPresence.userId].head, 
            "rotation", 60, framesToCompensate, 
            users[userPresence.userId].head.rotation, 
            new BABYLON.Vector3(userPresence.data.cameraRotation._x, userPresence.data.cameraRotation._y, userPresence.data.cameraRotation._z), 0);                           
    };

    const removeAvatar = (userPresence) => {
        users[userPresence.userId].head.dispose();
        users[userPresence.userId].body.dispose();
        users[userPresence.userId].label.dispose();
        delete users[userPresence.userId];
    }

    const createScene = function () {
            var scene = new BABYLON.Scene(engine);
            var lastTime = new Date().getTime();
            var baseURL;
            var sceneFile;
            let initialSceneCameraPosition;
            let advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
            let hdrTexture = new BABYLON.HDRCubeTexture("https://playground.babylonjs.com/textures/room.hdr", scene, 512);

            switch (selectedSceneToRender) {
                case "museum":
                    baseURL = "https://www.babylonjs.com/Scenes/Espilit/";
                    sceneFile = "Espilit.babylon";
                    break;
                case "wincafe":
                    baseURL = "https://www.babylonjs.com/Scenes/WCafe/";
                    sceneFile = "WCafe.babylon";
                    break;
                case "sponza":
                        baseURL = "https://www.babylonjs.com/Scenes/Sponza/";
                        sceneFile = "Sponza.babylon";
                        break;
                case "hillvalley":
                            baseURL = "https://www.babylonjs.com/Scenes/HillValley/";
                            sceneFile = "HillValley.incremental.babylon";
                            break;
                case "appartment":
                default:
                    baseURL = "https://www.babylonjs.com/Scenes/flat2009/";
                    sceneFile = "flat2009.babylon";
                    break;
            }

            // https://playground.babylonjs.com/#ZAUBTN
            BABYLON.SceneLoader.Append(baseURL, sceneFile, scene, () => {
                if (scene.activeCamera) {
                    scene.activeCamera.ellipsoid = new BABYLON.Vector3(0.1, 0.6, 0.1);
                    scene.activeCamera.position.y = 1.2;
                    initialSceneCameraPosition = scene.activeCamera.position.clone();
                    scene.activeCamera.attachControl(canvas);

                    // Register listener for changes to presence
                    presence.on("presenceChanged", (userPresence, local) => {
                        // If it's not the local user
                        if (!local) {
                            // And if it's the first time this new user is sending data
                            if (!users[userPresence.userId]) {
                                users[userPresence.userId] = {};
                                console.log("new user is broadcasting, creating his local avatar.");
                                let avatar = createAvatarBody(initialSceneCameraPosition, userPresence, hdrTexture);
                                let label = createLabelForAvatar(avatar, userPresence, advancedTexture);

                                users[userPresence.userId].body = avatar.body;
                                users[userPresence.userId].head = avatar.head;
                                users[userPresence.userId].label = label;
                            }
                            else {
                                console.dir(userPresence);
                                if (presence.state === "online") {
                                    console.log("Existing user.");
                                    updateAvatarPositionAndRotation(userPresence);
                                }
                                else {
                                    console.log("User has left.");
                                }
                            }
                        }
                    });

                    // Start tracking presence
                    presence.initialize(context?.user.id, {
                        name: name,
                        picture: defaultAvatarInformation.picture,
                    });

                    console.log("userId: " + context?.user.id);

                    window.setInterval(() => {
                        for (var user in users) {
                            if (presence.getPresenceForUser(user).state === "offline") {
                                removeAvatar(presence.getPresenceForUser(user));
                            };
                        }
                    }, 2000);

                    // Babylon.js event sent everytime the view matrix is changed
                    // Useful to know either a position, a rotation or
                    // both have been updated
                    scene.activeCamera.onViewMatrixChangedObservable.add(() => {
                        // sending new camera position & rotation updates every 100 ms
                        // to avoid sending too frequent updates over the network
                        if (new Date().getTime() - lastTime >= updateFrequencies && presence.isInitialized) {
                             presence.updatePresence(PresenceState.online, {
                                cameraPosition: scene.activeCamera.position,
                                cameraRotation: scene.activeCamera.rotation,
                                name: name,
                                picture: presence.data.picture,
                            });
                            lastTime = new Date().getTime();
                        }
                    });
                }
            });
            return scene;
    };
    
    const scene = createScene(); //Call the createScene function

    // Register a render loop to repeatedly render the scene
    engine.runRenderLoop(function () {
        if (scene && scene.activeCamera) {
            scene.render();
        }
    });
    // Watch for browser/canvas resize events
    window.addEventListener("resize", function () {
            engine.resize();
    });
}

// SIDEBAR VIEW
const sideBarTemplate = document.createElement("template");

sideBarTemplate["innerHTML"] = `
  <style>
    .wrapper { text-align: center; color: white }
    .title { font-size: large; font-weight: bolder; }
    .text { font-size: medium; }
    button {
        margin-left: auto;
        margin-right: auto;
        display: block;
        margin-top: 20px;
    }
  </style>
  <div class="wrapper">
    <p class="title">Choose your 3D content</p>
    <p class="text">Press the 'share to stage' button to share your selected 3D scene to the meeting stage.</p>
    <label for="3dscenes">Scene:</label>
    <select name="3dscenes"" id="3dscenes">
        <option value="apartment">Apartment</option>
        <option value="museum">Museum</option> 
        <option value="wincafe">Windows Café</option>
        <option value="sponza">Sponza</option>
        <option value="hillvalley">Hill Valley</option>
    </select>
  </div>
`;

function renderSideBar(elem) {
    elem.appendChild(sideBarTemplate.content.cloneNode(true));
    const shareToStageButton = document.createElement("button");
    shareToStageButton["innerHTML"] = "Share to Stage";
    shareToStageButton.onclick = () => {
        var selector = document.querySelector('select');
        var selected3DScene = selector.options[selector.selectedIndex].value;
        shareToStage(selected3DScene);
    };
    elem.appendChild(shareToStageButton);
}

function shareToStage(selected3DScene) {
    meeting.shareAppContentToStage((error, result) => {
        if (!error) {
            console.log("Started sharing, sharedToStage result");
        } else {
            console.warn("SharingToStageError", error);
        }
    }, window.location.origin + "?inTeams=1&view=stage&scene=" + selected3DScene);
}

// SETTINGS VIEW
const settingsTemplate = document.createElement("template");

settingsTemplate["innerHTML"] = `
  <style>
    .wrapper { text-align: center; color: white; overflow-y: hidden; }
    .title { font-size: large; font-weight: bolder; }
    .text { font-size: medium; }
    img { width: 100%; }
  </style>
  <div class="wrapper">
    <p class="title">Welcome to Metaverse Live Share!</p>
    <p class="text">Press the save button to continue.</p>
    <img src="src/assets/screenshot1.jpg" />
  </div>
`;

function renderSettings(elem) {
    elem.appendChild(settingsTemplate.content.cloneNode(true));

    // Save the configurable tab
    pages.config.registerOnSaveHandler((saveEvent) => {
        pages.config.setConfig({
            websiteUrl: window.location.origin,
            contentUrl: window.location.origin + "?inTeams=1&view=content",
            entityId: "FluidMetaverseLiveShare",
            suggestedDisplayName: "Metaverse Live Share",
        });
        saveEvent.notifySuccess();
    });

    // Enable the Save button in config dialog
    pages.config.setValidityState(true);
}

// Error view
const errorTemplate = document.createElement("template");

errorTemplate["inner" + "HTML"] = `
  <style>
    .wrapper { text-align: center; color: red }
    .error-title { font-size: large; font-weight: bolder; }
    .error-text { font-size: medium; }
  </style>
  <div class="wrapper">
    <p class="error-title">Something went wrong</p>
    <p class="error-text"></p>
    <button class="refresh"> Try again </button>
  </div>
`;

function renderError(elem, error) {
    elem.appendChild(errorTemplate.content.cloneNode(true));
    const refreshButton = elem.querySelector(".refresh");
    const errorText = elem.querySelector(".error-text");

    // Refresh the page on click
    refreshButton.onclick = () => {
        window.location.reload();
    };
    console.error(error);
    const errorTextContent = error.toString();
    errorText.textContent = errorTextContent;
}

start().catch((error) => console.error(error));
