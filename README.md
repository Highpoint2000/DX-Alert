# DX Alert Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin provides email notifications and Telegram Messages for DX reception with the FM-DX web server depending on a selected distance and frequency.

![image](https://github.com/user-attachments/assets/a9da9fb2-3cc8-4e6f-a83d-0a939d6d2c5e)



## Version 3.1 (only works from web server version 1.2.6 !!!)

- Fixed configuration is now stored in configPlugin.json
- Switching the communication protocol to session ID instead of IP address 
- Fixed incorrect message when deactivating the DX Alert button
- Download link adjustments are the scanner log files
- Revised error message

## Installation notes:

1. [Download](https://github.com/Highpoint2000/DX-Alert/releases) the last repository as a zip
2. Unpack all files from the plugins folder to ..fm-dx-webserver-main\plugins\ 
3. copy, rename and overwrite the index.js version that matches the web server: \server\index_x.x.x.js to ..fm-dx-webserver-main\server\index.js
4. Configure the email or Telegram settings in the header of the dx-alert_server.js file
5. Start/Restart the fm-dx-webserver with "npm run webserver" on node.js console, check the console informations
6. Activate the DX-Alert plugin in the settings

## Notes: 

To use the plugin, you must enter a valid email address in the web server or script header, activate the email service and enter your provider's email settings for the SMTP server. If you want to use Telegram, you must enter the corresponding chat token of the Telegram group and the token of the Telegram bot (which must be a member of the Telegram group). You also have the option of entering an individual notification interval in minutes and a distance in km in the header of the server script from when the plugin should notify you. If you enter 0 minutes you will be notified of every DX protocol. After entering or changing the values, the server must be restarted! The plugin can only be activated as an authenticated user or as an admin. After registering, you can send a test email to the registered address or a test message to the Telegram group by pressing and holding the DX Alert button. The plugin is a useful addition to the [Scanner Plugin](https://github.com/Highpoint2000/webserver-scanner), so that you are always informed in the background when the reception conditions change positively!

Users who also use the Extended Description plugin should download the modified version here, which displays the buttons in one line: https://github.com/Highpoint2000/Extended-Description-plugin-MOD-by-Highpoint-

![image](https://github.com/user-attachments/assets/18a0eae5-af68-4b81-875a-07e385517c79)

Please note:

- The plugin does not log receptions. Only the first station found, above the entered kilometer limit and time interval, will be sent with detailed information as an indication of overreach!
- If the alert button is active, you will also receive an email if another user of the web server receives DX stations while zapping
- In the Netherlands and Germany there are already existing Telegram DX Alert groups ("NL FM DX Alerts" und "DE FM DX Alerts") that you can join and publish your logs. You can get further information and the tokens from me.

## History: 

### Version 3.0 (only works from web server version 1.2.6 !!!)

- Telegram integration (Group chat support)
- Own email provider configurable (e.g. GMAIL)
- alert frequency & distance are now completely freely configurable

### Version 2.0 SERVER BASED VERSION (only works from web server version 1.2.6 !!!)

- Server based module for background alerts (browser no more required!)
- Status Notifications in the browser in a new design

### Version 1.1b (only works from web server version 1.2.6 !!!)

- compatible with changed websocket data in version 1.2.6
- Use of the email address stored in the web server
- Browser-based last state restore

### Version 1.1a (only works from web server version 1.2.3 !!!)

- DX-ALERT Button Position Update (several buttons in one line)

### Version 1.1 (only works from web server version 1.2.3 !!!)

- Test email integration

### Version 1.0 (only works from web server version 1.2.3 !!!)

- email Alert for DX Receiption
