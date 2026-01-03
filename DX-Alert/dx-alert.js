(() => {
  ////////////////////////////////////////////////////////////////////
  ///                                                         	   ///
  ///  DX ALERT CLIENT SCRIPT FOR FM-DX-WEBSERVER (V3.6c)          ///
  ///                                                              ///
  ///  by Highpoint                last update: 03.01.26           ///
  ///                                                              ///
  ///  Thanks to _zer0_gravity_ for the Telegram Code!             ///
  ///                                                              ///
  ///  https://github.com/Highpoint2000/DX-Alert                   ///
  ///                                                              ///
  ////////////////////////////////////////////////////////////////////

  ///  This plugin only works from web server version 1.3.5 !!!

  const updateInfo = true; // Enable or disable version check

  /////////////////////////////////////////////////////////////////////

  const plugin_version = '3.6c';
  const plugin_path = 'https://raw.githubusercontent.com/highpoint2000/DX-Alert/';
  const plugin_JSfile = 'main/DX-Alert/dx-alert.js';
  const plugin_name = 'DX Alert';

  let AlertActive = false;
  let wsSendSocket;
  let pressTimer;
  let buttonPressStarted = null; // Timestamp for button press start
  let ValidEmailAddress = null; // Email address for alerts (can be comma-separated list)
  let NewEmailFrequency = null;
  let AlertDistance = null;
  let AlertDistanceMax = null;
  let EmailAlert;
  let alertShown = false;
  var isTuneAuthenticated = false;
  const PluginUpdateKey = `${plugin_name}_lastUpdateNotification`; // Unique key for localStorage

  // Generate a random 12-digit session ID to replace the IP address
  let sessionId = Math.floor(Math.random() * 1e12)
    .toString()
    .padStart(12, '0'); // Generates a 12-digit random session ID

  let checkSuccessTimer;

  // Get web server URL and port from the current page URL
  const currentURL = new URL(window.location.href);
  const WebserverURL = currentURL.hostname;
  const WebserverPath = currentURL.pathname.replace(/setup/g, '');
  let WebserverPORT =
    currentURL.port || (currentURL.protocol === 'https:' ? '443' : '80'); // Default ports if not specified

  // Determine WebSocket protocol and port
  const protocol = currentURL.protocol === 'https:' ? 'wss:' : 'ws:'; // Determine WebSocket protocol
  const WebsocketPORT = WebserverPORT; // Use the same port as HTTP/HTTPS
  const WEBSOCKET_URL = `${protocol}//${WebserverURL}:${WebsocketPORT}${WebserverPath}data_plugins`; // WebSocket URL with /data_plugins

  // Function to set up the WebSocket connection for sending messages
  async function setupSendSocket() {
    if (!wsSendSocket || wsSendSocket.readyState === WebSocket.CLOSED) {
      try {
        wsSendSocket = new WebSocket(WEBSOCKET_URL);
        wsSendSocket.addEventListener("open", () => {
          console.log("Send WebSocket connected.");
          sendInitialWebSocketMessage();
        });
        wsSendSocket.addEventListener("message", handleWebSocketMessage);
        wsSendSocket.addEventListener("error", (error) =>
          console.error("Send WebSocket error:", error)
        );
        wsSendSocket.addEventListener("close", (event) => {
          console.log("Send WebSocket closed:", event);
          setTimeout(setupSendSocket, 5000); // Reconnect after 5 seconds
        });
      } catch (error) {
        console.error("Failed to setup Send WebSocket:", error);
        sendToast(
          'error important',
          'DX-Alert',
          `Failed to setup Send WebSocket`,
          false,
          false
        );
        setTimeout(setupSendSocket, 5000); // Reconnect after 5 seconds
      }
    }
  }

  let processingAllowed = true; // Allow message processing

  // Function to handle incoming WebSocket messages
  function handleWebSocketMessage(event) {
    try {
      const eventData = JSON.parse(event.data);
      if (eventData.type === 'DX-Alert' && eventData.source !== sessionId) {

        // IMPORTANT: Check if the button already exists in the DOM.
        const btn = document.getElementById('DX-Alert-on-off');
        if (!btn) {
          // If the button does not exist yet, delay processing.
          setTimeout(() => handleWebSocketMessage(event), 500);
          return;
        }

        // Optional: Throttling to prevent multiple processings
        const currentTime = Date.now();
        if (
          !handleWebSocketMessage.lastProcessedTime ||
          currentTime - handleWebSocketMessage.lastProcessedTime >= 1000
        ) {
          handleWebSocketMessage.lastProcessedTime = currentTime;

          const { status, email, TelegramAlert, EmailAlert, freq, dist, distMax, message } = eventData.value;

          switch (status) {
            case 'success':
              if (eventData.target === sessionId) {
                if (EmailAlert === 'on' && TelegramAlert === 'on') {
                  sendToast(
                    'success important',
                    'DX-Alert',
                    `Test email request sent to ${ValidEmailAddress} and Telegram successfully!!!`,
                    false,
                    false
                  );
                  console.log("Server response: Test email request sent to both services.");
                } else if (EmailAlert === 'on') {
                  sendToast(
                    'success important',
                    'DX-Alert',
                    `Test email request sent to ${ValidEmailAddress} successfully!!!`,
                    false,
                    false
                  );
                  console.log("Server response: Test email request sent to email service.");
                } else if (TelegramAlert === 'on') {
                  sendToast(
                    'success important',
                    'DX-Alert',
                    `Test notification request sent to Telegram successfully!!!`,
                    false,
                    false
                  );
                  console.log("Server response: Test notification request sent to Telegram.");
                } else {
                  sendToast(
                    'error',
                    'DX-Alert',
                    `No services are configured!`,
                    false,
                    false
                  );
                }
              }
              break;

            case 'sent':
              // Clean the message: Remove the Logfile link part for the toast
              // The server sends "Text... \n\nLogfile: URL". We split and take the first part.
              let cleanMessage = message;
              if (message.includes("Logfile:")) {
                cleanMessage = message.split("Logfile:")[0].trim();
              }

              // Format the email list (replace comma with comma+break for better readability in toast)
              let formattedEmails = email ? email.replace(/, /g, ',<br>') : '';

              if (EmailAlert === 'on' && TelegramAlert === 'on') {
                console.log(`DX-Alert: ${cleanMessage} > Sent Telegram Message and email to ${email}`);
                if (isTuneAuthenticated) {
                  sendToast(
                    'success important',
                    'DX-Alert',
                    `${cleanMessage}<br><br><b>Telegram & Email sent to:</b><br>${formattedEmails}`,
                    false,
                    false
                  );
                }
              } else if (EmailAlert === 'on') {
                console.log(`DX-Alert: ${cleanMessage} > Email sent to ${email}`);
                if (isTuneAuthenticated) {
                  sendToast(
                    'success important',
                    'DX-Alert',
                    `${cleanMessage}<br><br><b>Email sent to:</b><br>${formattedEmails}`,
                    false,
                    false
                  );
                }
              } else if (TelegramAlert === 'on') {
                console.log(`DX-Alert: ${cleanMessage} > Sent Telegram Message`);
                if (isTuneAuthenticated) {
                  sendToast(
                    'success important',
                    'DX-Alert',
                    `${cleanMessage}<br><br><b>Sent Telegram Message</b>`,
                    false,
                    false
                  );
                }
              } else {
                sendToast(
                  'error',
                  'DX-Alert',
                  `No services are configured!`,
                  false,
                  false
                );
              }
              break;

            case 'error':
              if (EmailAlert === 'on') {
                console.error("Server response: Test email request failed.", message);
                sendToast(
                  'error',
                  'DX-Alert',
                  `Error! Failed to send test email to ${ValidEmailAddress}!`,
                  false,
                  false
                );
              } else if (TelegramAlert === 'on') {
                console.error("Server response: Telegram test request failed.", message);
                sendToast('error', 'DX-Alert', `Failed to send test to Telegram!`, false, false);
              }
              break;

            case 'on':
            case 'off':
              ValidEmailAddress = email;
              // Set button status (ensures adding/removing the "active" class)
              setButtonStatus(status === 'on');
              AlertActive = status === 'on';
              NewEmailFrequency = freq;
              AlertDistance = dist;
              AlertDistanceMax = distMax;

              if (
                isTuneAuthenticated &&
                status === 'on' &&
                (eventData.target === '000000000000' || eventData.target === sessionId)
              ) {
                const alertStatusMessage = `DX ALERT ${AlertActive ? 'activated' : 'deactivated'}`;
                let detailsMessage = '';
                if (AlertActive) {
                  detailsMessage = ` (Alert distance: ${AlertDistance}-${AlertDistanceMax} km / frequency: ${NewEmailFrequency} min.)`;
                }
                console.log(`${alertStatusMessage}${detailsMessage}`);
                sendToast(
                  'info',
                  'DX-Alert',
                  AlertActive
                    ? `Activated for ${EmailAlert === 'on' ? ValidEmailAddress : 'Telegram'}${detailsMessage}`
                    : 'Deactivated',
                  false,
                  false
                );
              }
              break;
          }
        } else {
          console.log("Throttling: Ignored message due to time limit.");
        }
      }

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
          target: 'Server',
        });
        wsSendSocket.send(message);
      } else {
        console.error('WebSocket connection is not open.');
      }
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  // Start a timer to handle long presses on the button
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

  // Function to send a test email
  async function sendTestEmail() {
    if (!isTuneAuthenticated) {
      sendToast(
        'warning',
        'DX-Alert',
        'You must be authenticated as admin to use the DX ALERT feature!',
        false,
        false
      );
      return;
    }
    if (!ValidEmailAddress && EmailAlert === 'on') {
      sendToast(
        'warning',
        'DX-Alert',
        'Valid email address not set on the web server or in the dx-alert config script!',
        false,
        false
      );
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
        target: 'Server',
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
      sendToast(
        'error',
        'DX-Alert',
        `Error! Failed to send test email to ${ValidEmailAddress}!`,
        false,
        false
      );
    }
  }

  // Toggle alert status and update WebSocket
  async function toggleAlert() {
    if (!isTuneAuthenticated) {
      sendToast(
        'warning',
        'DX-Alert',
        'You must be authenticated as admin to use the DX ALERT feature!',
        false,
        false
      );
      return;
    }

    AlertActive = !AlertActive;

    try {
      const message = JSON.stringify({
        type: 'DX-Alert',
        value: { status: AlertActive ? 'on' : 'off' },
        source: sessionId,
        target: 'Server',
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

  // Check for administrator mode
  function checkAdminMode() {
    const bodyText = document.body.textContent || document.body.innerText;
    isTuneAuthenticated =
      bodyText.includes("You are logged in as an administrator.") ||
      bodyText.includes("You are logged in as an adminstrator.");
    console.log(
      isTuneAuthenticated
        ? `DX ALERT Authentication successful.`
        : "Authentication failed."
    );
  }

  // Add active button style rule once
  (function addActiveButtonStyle() {
    if (!document.getElementById('dx-alert-active-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'dx-alert-active-style';
      styleEl.textContent = `
        /* Style for the active button */
        #DX-Alert-on-off.active {
          background-color: var(--color-2) !important;
          filter: brightness(120%);
        }
      `;
      document.head.appendChild(styleEl);
    }
  })();

  // Function to set the button status (active/inactive) using the button ID
  function setButtonStatus(isActive) {
    const btn = document.getElementById('DX-Alert-on-off');
    if (btn) {
      // Add the class "active" if isActive is true, otherwise remove it
      if (isActive) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      AlertActive = isActive;
    }
  }

  // Function to check if the update notification has already been shown today
  function shouldShowNotification() {
    const lastNotificationDate = localStorage.getItem(PluginUpdateKey);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (lastNotificationDate === today) {
      return false; // Notification already shown today
    }
    localStorage.setItem(PluginUpdateKey, today);
    return true;
  }

  // Function to check the plugin version
  function checkPluginVersion() {
    fetch(`${plugin_path}${plugin_JSfile}`)
      .then((response) => response.text())
      .then((script) => {
        const pluginVersionMatch = script.match(/const plugin_version = '([\d.]+[a-z]*)?';/);
        if (!pluginVersionMatch) {
          console.error(`${plugin_name}: Plugin version could not be found`);
          return;
        }

        const externalPluginVersion = pluginVersionMatch[1];

        // Function to compare versions
        function compareVersions(local, remote) {
          const parseVersion = (version) =>
            version
              .split(/(\d+|[a-z]+)/i)
              .filter(Boolean)
              .map((part) => (isNaN(part) ? part : parseInt(part, 10)));

          const localParts = parseVersion(local);
          const remoteParts = parseVersion(remote);

          for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
            const localPart = localParts[i] || 0;
            const remotePart = remoteParts[i] || 0;

            if (typeof localPart === 'number' && typeof remotePart === 'number') {
              if (localPart > remotePart) return 1;
              if (localPart < remotePart) return -1;
            } else if (typeof localPart === 'string' && typeof remotePart === 'string') {
              if (localPart > remotePart) return 1;
              if (localPart < remotePart) return -1;
            } else {
              return typeof localPart === 'number' ? -1 : 1;
            }
          }
          return 0;
        }

        const comparisonResult = compareVersions(plugin_version, externalPluginVersion);
        if (comparisonResult === 1) {
          console.log(`${plugin_name}: The local version is newer than the plugin version.`);
        } else if (comparisonResult === -1) {
          if (shouldShowNotification()) {
            console.log(`${plugin_name}: Plugin update available: ${plugin_version} -> ${externalPluginVersion}`);
            sendToast(
              'warning important',
              `${plugin_name}`,
              `Update available:<br>${plugin_version} -> ${externalPluginVersion}`,
              false,
              false
            );
          }
        } else {
          console.log(`${plugin_name}: The local version matches the plugin version.`);
        }
      })
      .catch((error) => {
        console.error(`${plugin_name}: Error fetching the plugin script:`, error);
      });
  }

  // DOMContentLoaded: Initialize WebSocket and check for admin authentication
  document.addEventListener('DOMContentLoaded', () => {
    setupSendSocket();
    checkAdminMode();
  });

  // Plugin version check (if updateInfo is true and admin is logged in)
  setTimeout(() => {
    if (updateInfo && isTuneAuthenticated) {
      checkPluginVersion();
    }
  }, 200);

  // ───────────────────────────────────────────────────────────────
  // New button creation and migration of event listeners
  function createButton(buttonId) {
    (function waitForFunction() {
      const maxWaitTime = 10000;
      let functionFound = false;

      const observer = new MutationObserver((mutationsList, observer) => {
        if (typeof addIconToPluginPanel === 'function') {
          observer.disconnect();
          // Create the button via the plugin panel
          addIconToPluginPanel(buttonId, "DX Alert", "solid", "bell", `Plugin Version: ${plugin_version}`);
          functionFound = true;

          const buttonObserver = new MutationObserver(() => {
            const $pluginButton = $(`#${buttonId}`);
            if ($pluginButton.length > 0) {
              // Add the event listeners
              $pluginButton.on('mousedown', startPressTimer);
              $pluginButton.on('mouseup mouseleave', cancelPressTimer);
              // Remove a separate click handler to avoid conflicts with the long press logic
              buttonObserver.disconnect();
            }
          });
          buttonObserver.observe(document.body, { childList: true, subtree: true });
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        if (!functionFound) {
          console.error(`Function addIconToPluginPanel not found after ${maxWaitTime / 1000} seconds.`);
        }
      }, maxWaitTime);
    })();

    // Additional CSS adjustments for the new button
    const aDXalertCss = `
      #${buttonId}:hover {
        color: var(--color-5);
        filter: brightness(120%);
      }
    `;
    $("<style>")
      .prop("type", "text/css")
      .html(aDXalertCss)
      .appendTo("head");
  }

  // Create the button with the ID 'DX-Alert-on-off'
  createButton('DX-Alert-on-off');
})();