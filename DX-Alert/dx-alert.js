(() => {
////////////////////////////////////////////////////////////////
///                                                          ///
///  DX ALERT CLIENT SCRIPT FOR FM-DX-WEBSERVER (V3.5c)      ///
///                                                          ///
///  by Highpoint                last update: 17.01.25       ///
///                                                          ///
///  Thanks to _zer0_gravity_ for the Telegram Code!         ///
///                                                          ///
///  https://github.com/Highpoint2000/DX-Alert               ///
///                                                          ///
////////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.2.8.1!!!

const updateInfo = true; // Enable or disable version check

/////////////////////////////////////////////////////////////////

    const plugin_version = '3.5c';
	const plugin_path = 'https://raw.githubusercontent.com/highpoint2000/DX-Alert/';
	const plugin_JSfile = 'main/DX-Alert/dx-alert.js'
	const plugin_name = 'DX Alert';
  
    let AlertActive = false;
    let wsSendSocket;
    let pressTimer;
    let buttonPressStarted = null; // Timestamp for button press start
    let ValidEmailAddress = null; // Email address for alerts
    let NewEmailFrequency = null;
    let AlertDistance = null;
	let AlertDistanceMax = null;
	let EmailAlert;
	let alertShown = false;
    var isTuneAuthenticated = false;
	const PluginUpdateKey = `${plugin_name}_lastUpdateNotification`; // Unique key for localStorage

    // Generate a random 12-digit session ID to replace the IP address
    let sessionId = Math.floor(Math.random() * 1e12).toString().padStart(12, '0'); // Generates a 12-digit random session ID

    const ipApiUrl = 'https://api.ipify.org?format=json'; // Placeholder URL (not used anymore)

    let checkSuccessTimer;

    // CSS styles for buttonWrapper
    const buttonWrapperStyles = `
        display: flex;
        justify-content: left;
        align-items: center;
        margin-top: 0px;
    `;
	
    // data_pluginsct WebserverURL and WebserverPORT from the current page URL
    const currentURL = new URL(window.location.href);
    const WebserverURL = currentURL.hostname;
    const WebserverPath = currentURL.pathname.replace(/setup/g, '');
    let WebserverPORT = currentURL.port || (currentURL.protocol === 'https:' ? '443' : '80'); // Default ports if not specified

    // Determine WebSocket protocol and port
    const protocol = currentURL.protocol === 'https:' ? 'wss:' : 'ws:'; // Determine WebSocket protocol
    const WebsocketPORT = WebserverPORT; // Use the same port as HTTP/HTTPS
    const WEBSOCKET_URL = `${protocol}//${WebserverURL}:${WebsocketPORT}${WebserverPath}data_plugins`; // WebSocket URL with /data_plugins

    // Function to set up WebSocket connection for sending messages
    async function setupSendSocket() {
        if (!wsSendSocket || wsSendSocket.readyState === WebSocket.CLOSED) {
            try {
                wsSendSocket = new WebSocket(WEBSOCKET_URL);
                wsSendSocket.addEventListener("open", () => {
                    console.log("Send WebSocket connected.");
                    sendInitialWebSocketMessage();
                });
                wsSendSocket.addEventListener("message", handleWebSocketMessage);
                wsSendSocket.addEventListener("error", (error) => console.error("Send WebSocket error:", error));
                wsSendSocket.addEventListener("close", (event) => {
                    console.log("Send WebSocket closed:", event);
                    setTimeout(setupSendSocket, 5000); // Reconnect after 5 seconds
                });
            } catch (error) {
                console.error("Failed to setup Send WebSocket:", error);
				sendToast('error important', 'DX-Alert', `Failed to setup Send WebSocket`, false, false);	
                setTimeout(setupSendSocket, 5000); // Reconnect after 5 seconds
            }
        }
    }
	
	let processingAllowed = true; // Allows message processing

    // Function to handle WebSocket messages
    function handleWebSocketMessage(event) {
        try {
            const eventData = JSON.parse(event.data);
			//console.log(eventData); 
            if (eventData.type === 'DX-Alert' && eventData.source !== sessionId) {
                let { status, EmailAlert, email, TelegramAlert, freq, dist, distMax, subject, message } = eventData.value;
				
				// Check if "Logfile" is present in the message
				if (message && message.includes("Logfile")) {
					message = message.split("Logfile")[0].trim(); // Keep only the part before "Logfile:"
				}
				
				if (!processingAllowed) {
					return; // Ignore the message if processing is not allowed
				}

				setTimeout(() => {
					processingAllowed = true;
				}, 100);

                switch (status) {
                    case 'success':
                        if (eventData.target === sessionId) {
							if (EmailAlert === 'on' && TelegramAlert === 'on') {
								sendToast('success important', 'DX-Alert', `Test email request sent to ${ValidEmailAddress} and Telegram successfully!!!`, false, false);
								console.log("Server response: Test email request sent to ${ValidEmailAddress} and Telegram successfully.");	
								processingAllowed = false;								
							} else if (EmailAlert === 'on') {
								sendToast('success important', 'DX-Alert', `Test email request sent to ${ValidEmailAddress} successfully!!!`, false, false);
								console.log("Server response: Test email request sent to ${ValidEmailAddress} successfully.");	
								processingAllowed = false;
								} else if (TelegramAlert === 'on') {
									sendToast('success important', 'DX-Alert', `Test notification request sent to Telegram successfully!!!`, false, false);
									console.log("Server response: Test email request sent to Telegram successfully.");
									processingAllowed = false;
									} else {
										sendToast('error', 'DX-Alert', `no services are configured!`, false, false);
										processingAllowed = false;										
									}
						}
                        break;
                    case 'sent':
						if (EmailAlert === 'on' && TelegramAlert === 'on') {					
							console.log(`DX-Alert!!! ${message} > Sent Telegram Message and email to ${email}`);
							if (isTuneAuthenticated) {
								sendToast('success important', 'DX-Alert', `${message} > Sent Telegram Message and email to ${email}`, false, false);
								processingAllowed = false;
								}
							} else if (EmailAlert === 'on') {
								console.log(`DX-Alert!!! ${message} > Email sent to ${email}`);
								if (isTuneAuthenticated) {
									sendToast('success important', 'DX-Alert', `${message} > Email sent to ${email}`, false, false);
									processingAllowed = false;
									}
								} else if (TelegramAlert === 'on') {
									console.log(`DX-Alert!!! ${message} > Sent Telegram Message`);
									processingAllowed = false;
									if (isTuneAuthenticated) {
										sendToast('success important', 'DX-Alert', `${message} > Sent Telegram Message`, false, false);
										processingAllowed = false;
										}
									} else {
										sendToast('error', 'DX-Alert', `no services are configured!`, false, false);
										processingAllowed = false;										
									}
                    break;
                    case 'error':
						if (EmailAlert === 'on') {
							console.error("Server response: Test email request failed.", message);
							sendToast('error', 'DX-Alert', `Error! Failed to send test email to ${ValidEmailAddress}!`, false, false);	
							processingAllowed = false;							
						} else if (TelegramAlert === 'on') {
							console.error("Server response: Telegram Test request failed.", message);
							sendToast('error', 'DX-Alert', `failed to send test to Telegram!`, false, false);
							processingAllowed = false;
							} else if (EmailAlert === 'on' && TelegramAlert === 'on') {
								console.error("Server response: Telegram or email Test request failed.", message);
								sendToast('error', 'DX-Alert', `failed to send test to ${ValidEmailAddress} or to Telegram!`, false, false);
								processingAllowed = false;								
							}
                        break;
                    case 'on':
					case 'off':
						ValidEmailAddress = email;
						setButtonStatus(status === 'on');
						AlertActive = status === 'on';
						NewEmailFrequency = freq;
						AlertDistance = dist;
						AlertDistanceMax = distMax;
						setButtonStatus(AlertActive);

						if (!alertShown && isTuneAuthenticated && status === 'on' && (eventData.target === '000000000000' || eventData.target === sessionId)) {
							const alertStatusMessage = `DX ALERT ${AlertActive ? 'activated' : 'deactivated'}`;
							if (EmailAlert === 'on' && TelegramAlert === 'on') {
								const alertDetailsMessage = AlertActive ? ` (Alert distance: ${AlertDistance}-${AlertDistanceMax} km / frequency: ${NewEmailFrequency} min.)` : '';
								console.log(`${alertStatusMessage}${alertDetailsMessage}`);
								sendToast('info', 'DX-Alert', `activated for Telegram & ${ValidEmailAddress}\n(Alert distance: ${AlertDistance}-${AlertDistanceMax} km / frequency: ${NewEmailFrequency} min.)`, false, false);
								processingAllowed = false;
								} else if (EmailAlert === 'on') {
									const alertDetailsMessage = AlertActive ? ` (Alert distance: ${AlertDistance}-${AlertDistanceMax} km / frequency: ${NewEmailFrequency} min.)` : '';
									console.log(`${alertStatusMessage}${alertDetailsMessage}`);
									sendToast('info', 'DX-Alert', `activated for ${ValidEmailAddress}\n(Alert distance: ${AlertDistance}-${AlertDistanceMax} km / frequency: ${NewEmailFrequency} min.)`, false, false);
									processingAllowed = false;
									} else if (TelegramAlert === 'on') {
										const alertDetailsMessage = AlertActive ? ` (Alert distance: ${AlertDistance}-${AlertDistanceMax} km / frequency: ${NewEmailFrequency} min.)` : '';
										console.log(`${alertStatusMessage}${alertDetailsMessage}`);
										sendToast('info', 'DX-Alert', `activated for Telegram\n(Alert distance: ${AlertDistance}-${AlertDistanceMax} km / frequency: ${NewEmailFrequency} min.)`, false, false);
										processingAllowed = false;
									}

							alertShown = true;
						}	 
						break;
                }

            }
            
            // Check if no case was matched and execute the 500ms check
            if (checkSuccessTimer) {
                clearTimeout(checkSuccessTimer);
            }
        
        } catch (error) {
            console.error("Error handling WebSocket message:", error);
        }
    }

    // Function to send an initial WebSocket message with the session ID
    async function sendInitialWebSocketMessage() {
        try {
            if (wsSendSocket && wsSendSocket.readyState === WebSocket.OPEN) {
                const message = JSON.stringify({
                    type: 'DX-Alert',
                    value: { status: 'request' },
                    source: sessionId,
                    target: 'Server'
                });
                wsSendSocket.send(message);
            } else {
                console.error('WebSocket connection is not open.');
            }
        } catch (error) {
            console.error('Failed to send WebSocket message:', error);
        }
    }

    // Initialize the alert button once the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
        setupSendSocket();
        checkAdminMode();
        setTimeout(initializeAlertButton, 1000);
    });

    // Update button status based on whether alerts are active
    function setButtonStatus(isActive) {
        if (AlertButton) {
            AlertButton.classList.toggle('bg-color-4', isActive);
            AlertButton.classList.toggle('bg-color-2', !isActive);
            AlertActive = isActive;
        }
    }

    // Create the alert button and append it to the button wrapper
    const AlertButton = document.createElement('button');

    function initializeAlertButton() {
        const buttonWrapper = document.getElementById('button-wrapper') || createDefaultButtonWrapper();

        if (buttonWrapper) {
            AlertButton.id = 'DX-Alert-on-off';
            AlertButton.classList.add('hide-phone');
            AlertButton.setAttribute('data-tooltip', 'DX ALERT on/off');
            AlertButton.innerHTML = '<strong>DX ALERT</strong>';
            AlertButton.style.marginTop = '16px';
            AlertButton.style.marginLeft = '5px';
            AlertButton.style.width = '100px';
            AlertButton.classList.add('bg-color-2');
            AlertButton.style.borderRadius = '0px';
            AlertButton.title = `Plugin Version: ${plugin_version}`;
            buttonWrapper.appendChild(AlertButton);
            AlertButton.addEventListener('mousedown', startPressTimer);
            AlertButton.addEventListener('mouseup', cancelPressTimer);
            AlertButton.addEventListener('mouseleave', cancelPressTimer);
            console.log('Alert button successfully added.');
        } else {
            console.error('Unable to add button.');
        }
    }

    // Create a default button wrapper if it does not exist
    function createDefaultButtonWrapper() {
        const wrapperElement = document.querySelector('.tuner-info');
        if (wrapperElement) {
            const buttonWrapper = document.createElement('div');
            buttonWrapper.classList.add('button-wrapper');
            buttonWrapper.id = 'button-wrapper';
            buttonWrapper.appendChild(AlertButton);
            wrapperElement.appendChild(buttonWrapper);
            wrapperElement.appendChild(document.createElement('br'));
            return buttonWrapper;
        } else {
            console.error('Standard location not found. Unable to add button.');
            return null;
        }
    }

    // Start a timer to handle long presses of the button
    function startPressTimer() {
        buttonPressStarted = Date.now();
        pressTimer = setTimeout(() => {
            sendTestEmail();
            buttonPressStarted = null;
        }, 1000);
    }

    // Cancel the press timer and toggle alert status if needed
    function cancelPressTimer() {
        clearTimeout(pressTimer);
        if (buttonPressStarted) {
            toggleAlert();
			if (isTuneAuthenticated) {
				if (!AlertActive) {
					console.log(`DX ALERT deactivated`);
					sendToast('info', 'DX-Alert', 'Plugin deactivated', false, false);
				}
			}
        }
        buttonPressStarted = null;
    }
	
    // Funktion zum Senden einer Test-E-Mail
async function sendTestEmail() {
    if (!isTuneAuthenticated) {
        sendToast('warning', 'DX-Alert', 'You must be authenticated as admin to use the DX ALERT feature!', false, false);
        return;
    }
    if (!ValidEmailAddress && EmailAlert === 'on') {
        sendToast('warning', 'DX-Alert', 'Valid email address not set on the webserver or in the dx-alert config script!', false, false);
        return;
    }

    const testMessage = `This is a test for DX ALERT. The current alert status is ${AlertActive ? 'Active' : 'Inactive'}.`;
    const testSubject = "DX ALERT Test";

    console.log('DX ALERT Test initiated.');

    try {
        const message = JSON.stringify({
            type: 'DX-Alert',
            value: {
                status: 'test',
                email: ValidEmailAddress,
                subject: testSubject,
                message: testMessage,
            },
            source: sessionId,
            target: 'Server'
        });

        if (wsSendSocket && wsSendSocket.readyState === WebSocket.OPEN) {
            wsSendSocket.send(message);
            sendToast('info', 'DX-Alert', 'Test requested, please wait!', false, false);
            console.log('DX ALERT test message sent via WebSocket.');
        } else {
            console.error('WebSocket connection is not open.');
            sendToast('error', 'DX-Alert', 'WebSocket connection is not open.', false, false);
        }
    } catch (error) {
        console.error('Failed to send test email via WebSocket:', error);
        // Korrektur: Verwendung von Template-Literalen
        sendToast('error', 'DX-Alert', `Error! Failed to send test email to ${ValidEmailAddress}!`, false, false);
    }
}


    // Toggle alert status and update WebSocket
    async function toggleAlert() {
        if (!isTuneAuthenticated) {
            sendToast('warning', 'DX-Alert', 'You must be authenticated as admin to use the DX ALERT feature!', false, false);
			return;
		}

        AlertActive = !AlertActive;

        try {
            const message = JSON.stringify({
                type: 'DX-Alert',
                value: { status: AlertActive ? 'on' : 'off' },
                source: sessionId,
                target: 'Server'
            });

            if (wsSendSocket && wsSendSocket.readyState === WebSocket.OPEN) {
                wsSendSocket.send(message);
            } else {
                console.error('WebSocket connection is not open.');
            }
        } catch (error) {
            console.error('Failed to send WebSocket message:', error);
        }

    }

    function checkAdminMode() {
        const bodyText = document.body.textContent || document.body.innerText;
        isTuneAuthenticated = bodyText.includes("You are logged in as an administrator.") || bodyText.includes("You are logged in as an adminstrator.");
        console.log(isTuneAuthenticated ? `DX ALERT Authentication successful.` : "Authentication failed.");
    }
	
	 // Function to check if the notification was shown today
  function shouldShowNotification() {
    const lastNotificationDate = localStorage.getItem(PluginUpdateKey);
    const today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

    if (lastNotificationDate === today) {
      return false; // Notification already shown today
    }
    // Update the date in localStorage to today
    localStorage.setItem(PluginUpdateKey, today);
    return true;
  }

  // Function to check plugin version
  function checkPluginVersion() {
    // Fetch and evaluate the plugin script
    fetch(`${plugin_path}${plugin_JSfile}`)
      .then(response => response.text())
      .then(script => {
        // Search for plugin_version in the external script
        const pluginVersionMatch = script.match(/const plugin_version = '([\d.]+[a-z]*)?';/);
        if (!pluginVersionMatch) {
          console.error(`${plugin_name}: Plugin version could not be found`);
          return;
        }

        const externalPluginVersion = pluginVersionMatch[1];

        // Function to compare versions
		function compareVersions(local, remote) {
			const parseVersion = (version) =>
				version.split(/(\d+|[a-z]+)/i).filter(Boolean).map((part) => (isNaN(part) ? part : parseInt(part, 10)));

			const localParts = parseVersion(local);
			const remoteParts = parseVersion(remote);

			for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
				const localPart = localParts[i] || 0; // Default to 0 if part is missing
				const remotePart = remoteParts[i] || 0;

				if (typeof localPart === 'number' && typeof remotePart === 'number') {
					if (localPart > remotePart) return 1;
					if (localPart < remotePart) return -1;
				} else if (typeof localPart === 'string' && typeof remotePart === 'string') {
					// Lexicographical comparison for strings
					if (localPart > remotePart) return 1;
					if (localPart < remotePart) return -1;
				} else {
					// Numeric parts are "less than" string parts (e.g., `3.5` < `3.5a`)
					return typeof localPart === 'number' ? -1 : 1;
				}
			}

			return 0; // Versions are equal
		}


        // Check version and show notification if needed
        const comparisonResult = compareVersions(plugin_version, externalPluginVersion);
        if (comparisonResult === 1) {
          // Local version is newer than the external version
          console.log(`${plugin_name}: The local version is newer than the plugin version.`);
        } else if (comparisonResult === -1) {
          // External version is newer and notification should be shown
          if (shouldShowNotification()) {
            console.log(`${plugin_name}: Plugin update available: ${plugin_version} -> ${externalPluginVersion}`);
			sendToast('warning important', `${plugin_name}`, `Update available:<br>${plugin_version} -> ${externalPluginVersion}`, false, false);
            }
        } else {
          // Versions are the same
          console.log(`${plugin_name}: The local version matches the plugin version.`);
        }
      })
      .catch(error => {
        console.error(`${plugin_name}: Error fetching the plugin script:`, error);
      });
	}
	
	setTimeout(() => {

	// Execute the plugin version check if updateInfo is true and admin ist logged on
	if (updateInfo && isTuneAuthenticated) {
		checkPluginVersion();
		}
	}, 200);
		
})();
