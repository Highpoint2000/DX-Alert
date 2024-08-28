////////////////////////////////////////////////////////////////
///                                                          ///
///  DX ALERT SERVER SCRIPT FOR FM-DX-WEBSERVER (V3.0)       ///
///                                                          ///
///  by Highpoint                last update: 28.08.24       ///
///                                                          ///
///  Thanks to _zer0_gravity_ for the Telegram Code!         ///
///                                                          ///
///  https://github.com/Highpoint2000/DX-Alert               ///
///                                                          ///
////////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.2.6!!!

(() => {
    const plugin_version = 'V3.0 BETA';
    let AlertActive = false;
    let wsSendSocket;
    let pressTimer;
    let buttonPressStarted = null; // Timestamp for button press start
    let ValidEmailAddress = null; // Email address for alerts
    let NewEmailFrequency = null;
    let AlertDistance = null;
    let ipAddress = null; // Global IP address
    const ipApiUrl = 'https://api.ipify.org?format=json';
    let checkSuccessTimer;

    // CSS styles for buttonWrapper
    const buttonWrapperStyles = `
        display: flex;
        justify-content: left;
        align-items: center;
        margin-top: 0px;
    `;
	
	// Extract WebserverURL and WebserverPORT from the current page URL
    const currentURL = new URL(window.location.href);
    const WebserverURL = currentURL.hostname;
    const WebserverPath = currentURL.pathname.replace(/setup/g, '');
    let WebserverPORT = currentURL.port || (currentURL.protocol === 'https:' ? '443' : '80'); // Default ports if not specified

    // Determine WebSocket protocol and port
    const protocol = currentURL.protocol === 'https:' ? 'wss:' : 'ws:'; // Determine WebSocket protocol
    const WebsocketPORT = WebserverPORT; // Use the same port as HTTP/HTTPS
    const WEBSOCKET_URL = `${protocol}//${WebserverURL}:${WebsocketPORT}${WebserverPath}extra`; // WebSocket URL with /extra

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
                setTimeout(setupSendSocket, 5000); // Reconnect after 5 seconds
            }
        }
    }

    // Function to handle WebSocket messages
    function handleWebSocketMessage(event) {

        try {
            const eventData = JSON.parse(event.data);
			console.log(eventData); 
            if (eventData.type === 'DX-Alert' && eventData.source !== ipAddress) {
                const { status, EmailAlert, email, TelegramAlert, freq, dist, subject, message } = eventData.value;

                switch (status) {
                    case 'success':
                        if (eventData.target === ipAddress) {
							if (EmailAlert === 'on' && TelegramAlert === 'on') {
								showCustomAlert(`Test email request sent to ${ValidEmailAddress} and Telegram successfully!!!`);	
								console.log("Server response: Test email request sent to ${ValidEmailAddress} and Telegram successfully.");								
							} else if (EmailAlert === 'on') {
								showCustomAlert(`Test email request sent to ${ValidEmailAddress} successfully!!!`);	
								console.log("Server response: Test email request sent to ${ValidEmailAddress} successfully.");	
								} else if (TelegramAlert === 'on') {
									showCustomAlert(`Test email request sent to Telegram successfully!!!`);	
									console.log("Server response: Test email request sent to Telegram successfully.");	
									} else {
										showCustomAlert(`Error: No services are configured!`);	
									}
						}
                        break;
                    case 'sent':
						if (EmailAlert === 'on' && TelegramAlert === 'on') {
							console.log(`DX-Alert: ${message} / Sent Telegram Message and email to ${email}`);
							if (isTuneAuthenticated) {
								showCustomAlert(`DX-Alert: ${message} / Sent Telegram Message and email to ${email}`);
								}
							} else if (EmailAlert === 'on') {
								console.log(`${message} / Email sent to ${email}`);
								if (isTuneAuthenticated) {
									showCustomAlert(`DX-Alert: ${message} / Email sent to ${email}`);
									}
								} else if (TelegramAlert === 'on') {
									console.log(`DX-Alert: ${message} / Sent Telegram Message`);
									if (isTuneAuthenticated) {
										showCustomAlert(`DX-Alert: ${message} / Sent Telegram Message`);
										}
									} else {
										showCustomAlert(`Error: No services are configured!`);	
									}
                    break;
                    case 'error':
                        console.error("Server response: Test email request failed.", message);
                        showCustomAlert(`Error! Failed to send test email to ${ValidEmailAddress} or telegram!`);
                        break;
                    case 'on':
                    case 'off':
                        ValidEmailAddress = email;
                        setButtonStatus(status === 'on');
                        AlertActive = status === 'on';
                        NewEmailFrequency = freq;
                        AlertDistance = dist;
                        setButtonStatus(AlertActive);

                        if (isTuneAuthenticated && status === 'on' && (eventData.target === '255.255.255.255' || eventData.target === ipAddress)) {
                            const alertStatusMessage = `DX ALERT ${AlertActive ? 'activated' : 'deactivated'}`;
							if (EmailAlert === 'on' && TelegramAlert === 'on') {
								const alertDetailsMessage = AlertActive ? ` (Alert distance: ${AlertDistance} km / frequency: ${NewEmailFrequency} min.)` : '';
								console.log(`${alertStatusMessage}${alertDetailsMessage}`);
								showCustomAlert(`DX ALERT activated for Telegram & ${ValidEmailAddress}\n(Alert distance: ${AlertDistance} km / frequency: ${NewEmailFrequency} min.)`);
								} else if (EmailAlert === 'on') {
									const alertDetailsMessage = AlertActive ? ` (Alert distance: ${AlertDistance} km / frequency: ${NewEmailFrequency} min.)` : '';
									console.log(`${alertStatusMessage}${alertDetailsMessage}`);
									showCustomAlert(`DX ALERT activated for ${ValidEmailAddress}\n(Alert distance: ${AlertDistance} km / frequency: ${NewEmailFrequency} min.)`);
									} else if (TelegramAlert === 'on') {
										const alertDetailsMessage = AlertActive ? ` (Alert distance: ${AlertDistance} km / frequency: ${NewEmailFrequency} min.)` : '';
										console.log(`${alertStatusMessage}${alertDetailsMessage}`);
										showCustomAlert(`DX ALERT activated for Telegram\n(Alert distance: ${AlertDistance} km / frequency: ${NewEmailFrequency} min.)`);
									}
                        }
                        break;
                }

            }
            
            // Check if no case was matched and execute the 500ms check
            if (checkSuccessTimer) {
                clearTimeout(checkSuccessTimer);
            }
            checkSuccessTimer = setTimeout(() => {
                if (!ValidEmailAddress) {
                    showCustomAlert('DX-Alert Server Error!');
                }
            }, 500);
        
        } catch (error) {
            console.error("Error handling WebSocket message:", error);
        }
    }

    // Function to send an initial WebSocket message with the IP address
    async function sendInitialWebSocketMessage() {
        try {
            const response = await fetch(ipApiUrl);
            const ipData = await response.json();
            ipAddress = ipData.ip;

            if (wsSendSocket && wsSendSocket.readyState === WebSocket.OPEN) {
                const message = JSON.stringify({
                    type: 'DX-Alert',
                    value: { status: 'request' },
                    source: ipAddress,
                    target: '127.0.0.1'
                });
                wsSendSocket.send(message);
            } else {
                console.error('WebSocket connection is not open.');
            }
        } catch (error) {
            console.error('Failed to fetch IP address or send WebSocket message:', error);
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
            AlertButton.addEventListener('click', handleAlertButtonClick);
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
        }
        buttonPressStarted = null;
    }
	
    // Function to send a test email
    async function sendTestEmail() {
        if (!isTuneAuthenticated) {
            showCustomAlert("You must be authenticated to use the DX ALERT feature.");
            return;
        }
        if (!ValidEmailAddress) {
            showCustomAlert("Valid email address not set on the webserver or in the dx-alert server script!");
            return;
        }

        const testMessage = `This is a test for DX ALERT. The current alert status is ${AlertActive ? 'Active' : 'Inactive'}.`;
		const testSubject = "DX ALERT Test";
		
        try {
            const response = await fetch(ipApiUrl);
            if (!response.ok) throw new Error('Failed to fetch IP address');
            const ipData = await response.json();
            const ipAddress = ipData.ip || 'unknown';

            const message = JSON.stringify({
                type: 'DX-Alert',
                value: {
                    status: 'test',
                    email: ValidEmailAddress,
                    subject: testSubject,
                    message: testMessage,
                },
                source: ipAddress,
                target: '127.0.0.1'
            });

            if (wsSendSocket && wsSendSocket.readyState === WebSocket.OPEN) {
                wsSendSocket.send(message);
                showCustomAlert('Test requested, please wait!');
            } else {
                console.error('WebSocket connection is not open.');
                showCustomAlert('WebSocket connection is not open.');
            }
        } catch (error) {
            console.error('Failed to send test email via WebSocket:', error);
            showCustomAlert('Error! Failed to send test email to ${ValidEmailAddress}!');
        }
    }

    // Function to show a custom alert notification
    function showCustomAlert(message) {
        // Create the notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';  // Adjust the top position as needed
        notification.style.left = '50%';  // Center horizontally
        notification.style.transform = 'translateX(-50%)';  // Adjust for exact center alignment
        notification.style.padding = '15px 30px';  // Larger padding for bigger notification
        notification.style.borderRadius = '8px';  // Slightly rounded corners
        notification.style.zIndex = '1000';
        notification.style.opacity = '1';
        notification.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        notification.style.fontSize = '16px';  // Larger font size
        notification.style.fontWeight = 'bold'; // Optional: make the text bold
        notification.style.textAlign = 'center'; // Center the text
        notification.style.color = '#fff';  // Set text color to white for other messages

        // Conditionally set the background color based on message content
        if (message.toLowerCase().includes('error')) {
            notification.style.backgroundColor = '#FF0000';  // Red for errors
        } else if (message.toLowerCase().includes('!!!')) {
			notification.style.backgroundColor = '#008000';  // Green for email alerts
		} else {		
            notification.style.backgroundColor = '#333';  // Dark gray for other messages
        }

        // Append the notification to the body
        document.body.appendChild(notification);

        // Remove the notification after 4 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(-20px)';  // Optional: slide up effect
            setTimeout(() => document.body.removeChild(notification), 500); // Remove the element after fade-out
        }, 4000);
    }

    // Handle click on the alert button (currently no status change)
    async function handleAlertButtonClick() {
        if (!isTuneAuthenticated) {
            showCustomAlert("You must be authenticated as admin to use the DX ALERT feature.");
            return;
        }
        // No status change on click; handled by press timer
    }

    // Toggle alert status and update WebSocket
    async function toggleAlert() {
        if (!isTuneAuthenticated) {
            showCustomAlert("You must be authenticated as admin to use the DX ALERT feature.");
            return;
        }

        AlertActive = !AlertActive;

        try {
            const response = await fetch(ipApiUrl);
            if (!response.ok) throw new Error('Failed to fetch IP address');
            const ipData = await response.json();
            ipAddress = ipData.ip || 'unknown';

            const message = JSON.stringify({
                type: 'DX-Alert',
                value: { status: AlertActive ? 'on' : 'off' },
                source: ipAddress,
                target: '127.0.0.1'
            });

            if (wsSendSocket && wsSendSocket.readyState === WebSocket.OPEN) {
                wsSendSocket.send(message);
            } else {
                console.error('WebSocket connection is not open.');
            }
        } catch (error) {
            console.error('Failed to fetch IP address or send WebSocket message:', error);
        }

    }

    // Check if user is authenticated as admin or receiver controller
    var isTuneAuthenticated = false;

    function checkAdminMode() {
        const bodyText = document.body.textContent || document.body.innerText;
        isTuneAuthenticated = bodyText.includes("You are logged in as an administrator.") || bodyText.includes("You are logged in as an adminstrator.");
        console.log(isTuneAuthenticated ? `DX ALERT Authentication successful.` : "Authentication failed.");
    }
})();
