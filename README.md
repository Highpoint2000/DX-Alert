# DX Alert Plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin provides email notifications for DX reception with the FM-DX web server depending on a selected distance and frequency.

![image](https://github.com/user-attachments/assets/1eaf2254-ab51-4724-bfdb-141be6326758)

![email](https://github.com/user-attachments/assets/f5b91972-d034-47b4-b297-245a43d4b01e)

## Version 1.1b (only works from web server version 1.2.3 !!!)

- Use of the email address stored in the web server
- Browser-based last state restore

## Installation notes:

1. [Download](https://github.com/Highpoint2000/DX-Alert/releases) the last repository as a zip
2. Unpack the Logger.js and the Logger folder with the logger-plugin.js into the web server plugins folder (..fm-dx-webserver-main\plugins) 
4. Restart the server
5. Activate the plugin it in the settings

## Notes: 

To use the plugin, you must enter a valid email address in the script header. You also have the option of entering a notification interval in minutes (minimum is 5 minutes) as well as a distance in km (minimum is 150 km) from when the plugin should notify you. The plugin can only be activated as an authenticated user or as an admin. After logging in, you can send a test email to the registered address by pressing and holding the DX-Alert button. Since this is a purely client-related application, the browser must not be closed during the indication! The plugin is a useful addition to the [scanner plugin](https://github.com/Highpoint2000/webserver-scanner) so that you are always informed if the reception conditions change positively!

Users who also use the Extended Description plugin should download the modified version from here, where the buttons are displayed in one line: https://github.com/Highpoint2000/Extended-Description-plugin-MOD-by-Highpoint-

![image](https://github.com/user-attachments/assets/18a0eae5-af68-4b81-875a-07e385517c79)

Please note:

- The plugin does not log receptions. Only the first station found, above the entered kilometer limit and time interval, will be sent with detailed information as an indication of overreach!
- In order not to receive too many emails (SPAM) and still not miss any DX receptions, it is recommended to set the time limit to 60 minutes and higher
- If you activate the alert button, you will also receive an email if another user of the web server receives DX stations while zapping

## History: 

## Version 1.1a (only works from web server version 1.2.3 !!!)

- DX-ALERT Button Position Update (several buttons in one line)

### Version 1.1 (only works from web server version 1.2.3 !!!)

- Test email integration

### Version 1.0 (only works from web server version 1.2.3 !!!)

- email Alert for DX Receiption
