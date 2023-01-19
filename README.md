# Metaverse Collaborative Virtual Visit - Live Share sample

This repository contains a simple app that enables all connected clients to navigate together inside a 3D scene and see each other positions. It uses the [Teams Live Share SDK](https://learn.microsoft.com/en-us/microsoftteams/platform/apps-in-teams-meetings/teams-live-share-overview?tabs=javascript) which is an abtraction layer over the [Fluid Framework](https://fluidframework.com/). You can find more Live Share SDK samples [there](https://github.com/microsoft/live-share-sdk).

![image](/src/assets/screenshot1.jpg)

To better understand this demo, you can also watch a 20 min talk I've done during this [M365 Community Call](https://pnp.github.io/blog/microsoft-365-platform-community-call/2023-01-17/). 

## Requirements

Node 12.17+

## Getting Started

After cloning the repository, install dependencies and start the application

```bash
npm install
npm start
```

Then open the app in various browsers or tabs to simulate various users. You can switch scenes by adding this query parameter at the end: http://localhost:8080/?scene=museum for instance.

## Testing the app in Teams

### Create a ngrok tunnel to allow Teams to reach your tab app

1. [Download ngrok](https://ngrok.com/download).
2. Launch ngrok with port 8080.
   `ngrok http 8080 --host-header=localhost`

### Create the app package to sideload into Teams

1. Open `.\manifest\manifest.json` and update values in it, including your [Application ID](https://learn.microsoft.com/microsoftteams/platform/resources/schema/manifest-schema#id).
2. You must replace `https://<<BASE_URI_DOMAIN>>` with the https path to your ngrok tunnel.
3. It is recommended that you also update the following fields.
    - Set `developer.name` to your name.
    - Update `developer.websiteUrl` with your website.
    - Update `developer.privacyUrl` with your privacy policy.
    - Update `developer.termsOfUseUrl` with your terms of use.
4. Create a zip file with the contents of `.\manifest` directory so that manifest.json, color.png, and outline.png are in the root directory of the zip file.
    - On Windows or Mac, select all files in `.\manifest` directory and compress them.
    - Give your zip file a descriptive name, e.g. `MetaverseLiveShare`.

### Test it out

1. Schedule a meeting for testing from calendar in Teams.
2. Join the meeting.
3. In the meeting window, tap on **+ Apps** and tap on **Manage apps** in the flyout that opens.
4. In the **Manage apps** pane, tap on **Upload a custom app**.
    - _Don't see the option to **Upload a custom app?!** Follow [instructions here](https://docs.microsoft.com/en-us/microsoftteams/teams-custom-app-policies-and-settings) to enable custom-apps in your tenant._
5. Select the zip file you created earlier and upload it.
6. In the dialog that shows up, tap **Add** to add your sample app into the meeting.
7. Now, back in the meeting window, tap **+ Apps** again and type the name of your app in the _Find an app_ textbox.
8. Select the app to activate it in the meeting.
9. In the configuration dialog, just tap **Save** to add your app into the meeting.
10. In the side panel, tap the share icon to put your app on the main stage in the meeting.
11. That's it! You should now see liveshare-metaverse on the meeting stage.

![image](/src/assets/screenshot2.jpg)

12. Your friends/colleagues invited to the meeting should be able to see your app on stage when they join the meeting.

Click on the picture below to watch a demo in video:

[![Watch the video](https://img.youtube.com/vi/49hciF7yAjA/maxresdefault.jpg)](https://youtu.be/49hciF7yAjA)
