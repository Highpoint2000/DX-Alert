# DX Alert Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin provides email notifications for DX reception with the FM-DX web server depending on a selected distance and frequency.

![image](https://github.com/user-attachments/assets/a2b6221d-aff2-4fcd-8c74-03852a467bc6)


![email](https://github.com/user-attachments/assets/f5b91972-d034-47b4-b297-245a43d4b01e)

## Version 2.0 (only works from web server version 1.2.6 !!!)

- Server based module for background alerts (browser no more required!)
- Status Notifications in the browser in a new design
- Activities are recorded in the server log (\plugins\DX-Alert)

## Installation notes:

1. [Download](https://github.com/Highpoint2000/DX-Alert/releases) the last repository as a zip
2. Unpack all files from the web server plugins folder to ..fm-dx-webserver-main\plugins\
3. copy, rename and overwrite the index.js version that matches the web server: \server\index_x.x.x.js to ..fm-dx-webserver-main\server\index.js
4. Start/Restart the fm-dx-webserver with "npm run webserver" on node.js console, check the console informations
5. Activate the DX-Alert plugin in the settings

## Notes: 

To use the plugin, you must enter a valid email address in the webserver or in the script header. You also have the option of entering an individual notification interval in minutes (at least 5 minutes) as well as a distance in km (at least 150 km) in the header of the server script, from when the plugin should notify you. After entering or changing the values, the server must be restarted! The plugin can only be activated as an authenticated user or as an admin. After logging in, you can send a test email to the registered address by pressing and holding the DX-Alert button. The plugin is a useful addition to the [scanner plugin](https://github.com/Highpoint2000/webserver-scanner) so that you are always informed in background if the reception conditions change positively!

Users who also use the Extended Description plugin should download the modified version from here, where the buttons are displayed in one line: https://github.com/Highpoint2000/Extended-Description-plugin-MOD-by-Highpoint-

![image](https://github.com/user-attachments/assets/18a0eae5-af68-4b81-875a-07e385517c79)

Please note:

- The plugin does not log receptions. Only the first station found, above the entered kilometer limit and time interval, will be sent with detailed information as an indication of overreach!
- In order not to receive too many emails (SPAM) and still not miss any DX receptions, it is recommended to set the time limit to 60 minutes and higher
- If the alert button is active, you will also receive an email if another user of the web server receives DX stations while zapping

## History: 

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
