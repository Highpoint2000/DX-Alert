# DX Alert Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin provides email notifications and Telegram Messages for DX reception with the FM-DX web server depending on a selected distance and frequency.

![image](https://github.com/user-attachments/assets/e10a6fba-4514-4c1a-a41f-4a3ae0435449)



### Version 3.5b (only works from web server version 1.2.8.1 and CanLogServer version 2.0 !!!)

- Fixed Problem with %20 in server name
- EmailUsername added

## Installation notes:

1. [Download](https://github.com/Highpoint2000/DX-Alert/releases) the last repository as a zip
2. Unpack all files from the plugins folder to ..fm-dx-webserver-main\plugins\ 
3. Stop or close the fm-dx-webserver
4. Start/Restart the fm-dx-webserver with "npm run webserver" on node.js console, check the console informations
5. Activate the DX-Alert plugin in the settings
6. Stop or close the fm-dx-webserver
7. Start/Restart the fm-dx-webserver with "npm run webserver" on node.js console, check the console informations
8. Configure personal email or Telegram settings in the automatically created DX-Alert.json (in the folder ..fm-dx-webserver-main\plugins_configs)
9. Stop or close the fm-dx-webserver
10. Start/Restart the fm-dx-webserver with "npm run webserver" on node.js console, check the console informations

## Configuration options:

The following variables can be changed in the DX-Alert.json:

    //// Alert Options ////
    Scanner_URL_PORT: '',			// OPTIONAL: External Webserver URL for Scanner Logfile Download (if plugin installed) e.g. 'http://fmdx.ddns.net:9080'
    AlertFrequency: 30, 			// Frequency for new alerts in minutes, 0 minutes means that every entry found will be sent (default: 30)
    AlertDistance: 250, 			// Distance for DX alarms in km (default: 250)
	AlertDistanceMax: 2500, 		// Maximum distance for DX alarms in km (default; 2500)
    StationMode: 'off',                     // Set it 'on' to enable alarm for every new logged TX Station (default: 'off')
    StationModeCanLogServer: '',		// OPTIONAL: Activates a central server to manage alarm repetitions (e.g. '127.0.0.1:2000', default is '') - only valid if StationMode: 'on' !
    
    //// Email Options ////
    EmailAlert: 'off', 			// Enable email alert feature, 'on' or 'off'
    EmailAddressTo: '', 			// Alternative email address for DX alerts, if the field remains empty, the email address of the web server will be used 
    EmailAddressFrom: '', 			// Sender email address, email address for account
    EmailPassword: '', 			// E-mail password/application-specific password 
    EmailHost: 'smtp.gmail.com', 	        // SMTP server for email, e.g. 'smtp.gmail.com' for GMAIL
    EmailPort: '587', 			// Port for email server, e.g. '587' for GMAIL
    EmailSecure: false, 			// Whether to use secure connection (true for port 465, false for other ports)
    
    //// Telegram Options ////
    TelegramAlert: 'off', 			// Telegram alert feature, 'on' or 'off'
    TelegramToken: '', 			// Telegram bot token
    TelegramChatId: '', 			// Telegram chat ID for sending alerts
    TelegramToken2: '', 			// Telegram bot token 2
    TelegramChatId2: '' 			// Telegram chat ID 2 for sending alerts

## Notes: 

To use the plugin, you must enter a valid email address in the web server or the configuration file, activate the email service and enter your provider's email settings for the SMTP server. If you want to use Telegram, you must enter the corresponding chat token of the Telegram group and the token of the Telegram bot (which must be a member of the Telegram group). You also have the option of entering an individual notification interval in minutes and a distance in km in the header of the server script from when the plugin should notify you. If you enter 0 minutes you will be notified of every DX protocol. After entering or changing the values, the server must be restarted! The plugin can only be activated as an authenticated user or as an admin. After registering, you can send a test email to the registered address or a test message to the Telegram group by pressing and holding the DX Alert button. The plugin is a useful addition to the [Scanner Plugin](https://github.com/Highpoint2000/webserver-scanner), so that you are always informed in the background when the reception conditions change positively!

Users who also use the Extended Description plugin should download the modified version here, which displays the buttons in one line: https://github.com/Highpoint2000/Extended-Description-plugin-MOD-by-Highpoint-

![image](https://github.com/user-attachments/assets/18a0eae5-af68-4b81-875a-07e385517c79)

Please note:

- The plugin does not log receptions. Only the first station found, above the entered kilometer limit and time interval, will be sent with detailed information as an indication of overreach!
- If the alert button is active, you will also receive an email if another user of the web server receives DX stations while zapping
- In the Netherlands and Germany there are already existing Telegram DX Alert groups ("NL FM DX Alerts" und "DE FM DX Alerts") that you can join and publish your logs. You can get further information and the tokens from me.
- If there are several web servers, it makes sense to register the alarms that have already been sent via a central server in order to avoid duplicate alarms. The [CanLogServer](https://github.com/Highpoint2000/canlog-server) can provide this functionality. When using the server, the log interval set in DX-Alert.json is inactive because the log interval set for the server has priority!

## History: 

### Version 3.5a (only works from web server version 1.2.8.1 and CanLogServer version 2.0 !!!)

- Implemented handling of special characters in the server name
- Daily update check for admin

### Version 3.5 (only works from web server version 1.2.8.1 and CanLogServer version 2.0 !!!)

- Upper distance limit installed
- Added second Telegram channel

### Version 3.4 (only works from web server version 1.2.8.1 and CanLogServer version 2.0 !!!)

- added Support for [CanLogServer](https://github.com/Highpoint2000/canlog-server) (Version 2.0)

### Version 3.3 (only works from web server version 1.2.8.1 !!!)

- StationMode added to be able to trigger an alarm at a specified interval for each new logged DX station

### Version 3.2c (only works from web server version 1.2.8.1 !!!)

- Security hole closed (thanks to Ryan G 🇮🇪!)

### Version 3.2b (only works from web server version 1.2.8.1 !!!)

- Bugfixing 
- Deactivate the websocket error

### Version 3.2a (only works from web server version 1.2.8.1 !!!)

- Adaptation of the web socket /extra to /data_plugins, index.js update is no longer needed from now on!

### Version 3.2 (only works from web server version 1.2.8 !!!)

- New notification design (Toast Notification)

### Version 3.1a (only works from web server version 1.2.6 !!!)

- Shortened message output in the browser
- Instructions for setting up Telegram included

### Version 3.1 (only works from web server version 1.2.6 !!!)

- Fixed configuration is now stored in configPlugin.json
- Switching the communication protocol to session ID instead of IP address 
- Fixed incorrect message when deactivating the DX Alert button
- Download link adjustments for the scanner log files
- Revised error message

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
