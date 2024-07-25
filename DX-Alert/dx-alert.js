////////////////////////////////////////////////////////////
///                                                      ///
///  DX ALERT SCRIPT FOR FM-DX-WEBSERVER (V1.1a)          ///
///                                                      ///
///  by Highpoint                last update: 25.07.24   ///
///                                                      ///
///  https://github.com/Highpoint2000/DX-Alert           ///
///                                                      ///
////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.2.3!!!

const EmailAddress = ''; // Email Address for DX Alerts
const NewEmailFrequency = 60; // Repetition frequency for new alerts in minutes, minimum is 5 minutes!
const AlertDistance = 180; // Distance for DX alarms in km, minimum is 150 kilometers!

/////////////////////////////////////////////////////////////////////////////////////

// Immediately invoked function expression (IIFE) to encapsulate the AlertPlugin code
(() => {
    const AlertPlugin = (() => {

        const plugin_version = 'V1.1a'; // Plugin Version
        let AlertSocket;
        let AlertActive = false; // Logger state
        const ServerName = document.title;
        let lastAlertTime = 0; // Timestamp of the last alert sent
        let lastAlertMessage = ""; // Stores the last alert message to avoid repetition
		
		// CSS Styles for buttonWrapper
		const buttonWrapperStyles = `
			display: flex;
			justify-content: left;
			align-items: center;
			margin-top: 0px;
		`; 

        // Setup AlertSocket connection
        async function setupAlertSocket() {
            if (!AlertSocket || AlertSocket.readyState === WebSocket.CLOSED) {
                try {
                    AlertSocket = await window.socketPromise;

                    AlertSocket.addEventListener("open", () => {
                        console.log("AlertSocket connected.");
                    });

                    AlertSocket.addEventListener("message", handleAlertSocketMessage);

                    AlertSocket.addEventListener("error", (error) => {
                        console.error("AlertSocket error:", error);
                    });

                    AlertSocket.addEventListener("close", (event) => {
                        console.log("AlertSocket closed:", event);
                        // Attempt to reconnect after a delay with exponential backoff
                        setTimeout(setupAlertSocket, 5000);
                    });

                } catch (error) {
                    console.error("Failed to setup AlertSocket:", error);
                    setTimeout(setupAlertSocket, 5000); // Retry after delay
                }
            }
        }

        async function handleAlertSocketMessage(event) {
            if (!AlertActive) return; // Do nothing if logger is inactive

            try {
                const eventData = JSON.parse(event.data);
                //console.log(eventData);
                const frequency = eventData.freq;
                const picode = eventData.pi;

                // Process data if frequency is not in the blacklist
                const txInfo = eventData.txInfo;
                const station = txInfo ? txInfo.station : "";
                const city = txInfo ? txInfo.city : "";
                const itu = txInfo ? txInfo.itu : "";
                const distance = txInfo ? txInfo.distance : "";

                // Check if the distance exceeds the AlertDistance and log to the console
                if (AlertActive && distance > AlertDistance && AlertDistance > '149') {
                    const now = Date.now();
                    const elapsedMinutes = (now - lastAlertTime) / 60000; // Corrected to 60000 (60 * 1000) for minutes
                    const message = `${frequency}, ${picode}, ${station}, ${city} [${itu}], ${distance} km`;

                    if (elapsedMinutes > NewEmailFrequency && message !== lastAlertMessage) {
                        const subject = `DX ALERT over ${AlertDistance} km !!!`;
                        sendEmail(message, subject);
                        console.log(message, subject);
                        lastAlertTime = now; // Update the last alert time
                        lastAlertMessage = message; // Update the last alert message
                    }
                }

            } catch (error) {
                console.error("Error handling AlertSocket message:", error);
            }
        }

        function sendEmail(message, subject) {
            // Gather the form data
            var formData = {
                service_id: 'service_xz2llv8',
                template_id: 'template_1yir5nq',
                user_id: '8UurLFsfxfeCVmTjB',
                template_params: {
                    'from_name': ServerName,
                    'to_email': EmailAddress,
                    'subject': subject,
                    'message': message,
                }
            };

            fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            .then(function(response) {
                if (response.ok) {
                    console.log('Email sent successfully!');
                } else {
                    return response.text().then(function(errorText) {
                        throw new Error('Failed to send email. Error: ' + errorText);
                    });
                }
            })
            .catch(function(error) {
                console.error(error.message);
            });
        }

        let pressTimer; // Variable to track the long press duration
		const AlertButton = document.createElement('button');

        function initializeAlertButton() {
            const buttonWrapper = document.getElementById('button-wrapper');
            
            checkAdminMode();
            setupAlertSocket();
            
            AlertButton.id = 'DX-Alert-on-off';
            AlertButton.classList.add('hide-phone');
            AlertButton.setAttribute('aria-label', 'DX ALERT');
            AlertButton.setAttribute('data-tooltip', 'DX ALERT on/off');
            AlertButton.innerHTML = '<strong>DX ALERT</strong>';
            AlertButton.style.marginTop = '16px';
            AlertButton.style.width = '100px';
            AlertButton.classList.add('bg-color-2');
            AlertButton.style.borderRadius = '0px';
            AlertButton.title = `Plugin Version: ${plugin_version}`;

            if (buttonWrapper) {
                AlertButton.style.marginLeft = '5px';
                buttonWrapper.appendChild(AlertButton);
                console.log('Alert button successfully added to button-wrapper.');
            } else {
                console.error('buttonWrapper Element not found. Adding button to standard location.');
                const wrapperElement = document.querySelector('.tuner-info');

                if (wrapperElement) {
                    const buttonWrapper = document.createElement('div');
					buttonWrapper.classList.add('button-wrapper');
					buttonWrapper.id = 'button-wrapper'; 
					buttonWrapper.appendChild(AlertButton);
					wrapperElement.appendChild(buttonWrapper);
					const emptyLine = document.createElement('br');
					wrapperElement.appendChild(emptyLine);
                } else {
                    console.error('standard location not found. Unable to add button.');
                }
            }

            AlertButton.addEventListener('click', toggleAlert);
            AlertButton.addEventListener('mousedown', startPressTimer);
            AlertButton.addEventListener('mouseup', cancelPressTimer);
            AlertButton.addEventListener('mouseleave', cancelPressTimer);

            checkAdminMode();
            setupAlertSocket();
        }

        function startPressTimer() {
            pressTimer = setTimeout(sendTestEmail, 2000); // 2000 ms for long press
        }

        function cancelPressTimer() {
            clearTimeout(pressTimer);
        }

        function sendTestEmail() {
            if (!isTuneAuthenticated) {
                console.warn("Test email press ignored: Not authenticated.");
                alert("You must be authenticated to use the DX ALERT feature.");
                return;
            }
            const testMessage = "This is a test email for DX ALERT.";
            const testSubject = "DX ALERT Test Email";
            sendEmail(testMessage, testSubject);
            console.log(`Test email sent to: ${EmailAddress}`);
            alert(`Test email sent to ${EmailAddress}.`);
        }

        function toggleAlert() {
            if (!isTuneAuthenticated) {
                console.warn("DX ALERT button press ignored: Not authenticated.");
                alert("You must be authenticated to use the DX ALERT feature.");
                return;
            }
            AlertActive = !AlertActive; // Toggle status
            lastAlertTime = 0; // Reset the last alert time
            lastAlertMessage = ""; // Reset the last alert message

            if (AlertActive) {
                AlertButton.classList.remove('bg-color-2');
                AlertButton.classList.add('bg-color-4');
                console.log("DX ALERT activated");
            } else {
                AlertButton.classList.remove('bg-color-4');
                AlertButton.classList.add('bg-color-2');
                console.log("DX ALERT deactivated");
            }
        }

        var isTuneAuthenticated = false; // Set global variable initially to false

        function checkAdminMode() {
            var bodyText = document.body.textContent || document.body.innerText;
            var isAdminLoggedIn = bodyText.includes("You are logged in as an administrator.") || bodyText.includes("You are logged in as an adminstrator.");
            var canControlReceiver = bodyText.includes("You are logged in and can control the receiver.");

            if (isAdminLoggedIn || canControlReceiver) {
                console.log("Admin or Tune mode found. DX ALERT Authentication successful.");
                isTuneAuthenticated = true;
            } else {
                console.log("No special authentication message found. Authentication failed.");
                isTuneAuthenticated = false;
            }
        }

        // Wait for the DOM to load and then execute the function after a short delay
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initializeAlertButton, 1000); // Delays execution by 1 seconds
        });

        document.addEventListener('DOMContentLoaded', function() {
            checkAdminMode();
        });

    })();
})();
