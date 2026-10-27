// ============================================================
// slibstream.js
// Clean microphone recording + Whisper transcription handler
// ============================================================

(() => {
    "use strict";

    // Prevent this file from initializing more than once
    if (window.__slibstreamInitialized) {
        console.warn("slibstream.js is already initialized.");
        return;
    }

    window.__slibstreamInitialized = true;

    let mediaRecorder = null;
    let audioChunks = [];
    let mediaStream = null;
    let isRecording = false;
    let isProcessing = false;

    // ------------------------------------------------------------
    // Find common microphone / transcription elements
    // ------------------------------------------------------------

    function findElement(...ids) {
        for (const id of ids) {
            const element = document.getElementById(id);
            if (element) return element;
        }
        return null;
    }

    const micButton = findElement(
        "mic",
        "micButton",
        "mic-btn",
        "microphoneButton",
        "voiceButton",
        "recordButton"
    );

    const transcriptionInput = findElement(
        "messageInput",
        "chatInput",
        "userInput",
        "prompt",
        "message"
    );

    // ------------------------------------------------------------
    // Status helper
    // ------------------------------------------------------------

    function setStatus(message) {
        console.log("Whisper:", message);

        const statusElement = findElement(
            "whisperStatus",
            "transcriptionStatus",
            "recordingStatus"
        );

        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    // ------------------------------------------------------------
    // Start microphone
    // ------------------------------------------------------------

    async function startRecording() {
        if (isRecording) {
            console.warn("Recording is already active.");
            return;
        }

        if (isProcessing) {
            console.warn("Previous transcription is still processing.");
            return;
        }

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error(
                    "Your browser does not support microphone recording."
                );
            }

            setStatus("Requesting microphone...");

            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            audioChunks = [];

            let mimeType = "";

            const supportedTypes = [
                "audio/webm;codecs=opus",
                "audio/webm",
                "audio/ogg;codecs=opus"
            ];

            for (const type of supportedTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }

            mediaRecorder = mimeType
                ? new MediaRecorder(mediaStream, { mimeType })
                : new MediaRecorder(mediaStream);

            mediaRecorder.onstart = () => {
                isRecording = true;
                setStatus("Recording...");
                console.log("microphone recording started");

                updateButton(true);
            };

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                    console.log(
                        "audio chunk received:",
                        event.data.size
                    );
                }
            };

            mediaRecorder.onerror = (event) => {
                console.error("MediaRecorder error:", event.error);
                setStatus("Recording error.");
            };

            mediaRecorder.onstop = async () => {
                isRecording = false;
                updateButton(false);

                setStatus("Preparing transcription...");

                try {
                    await processRecording();
                } catch (error) {
                    console.error("Transcription error:", error);
                    setStatus("Transcription failed.");
                }
            };

            mediaRecorder.start(250);

        } catch (error) {
            console.error("Microphone error:", error);

            isRecording = false;
            updateButton(false);

            if (error.name === "NotAllowedError") {
                setStatus("Microphone permission denied.");
            } else if (error.name === "NotFoundError") {
                setStatus("No microphone found.");
            } else {
                setStatus("Could not start microphone.");
            }
        }
    }

    // ------------------------------------------------------------
    // Stop microphone
    // ------------------------------------------------------------

    function stopRecording() {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            return;
        }

        setStatus("Stopping recording...");

        mediaRecorder.stop();

        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
    }

    // ------------------------------------------------------------
    // Process recording
    // ------------------------------------------------------------

    async function processRecording() {
        if (!audioChunks.length) {
            setStatus("No audio recorded.");
            return;
        }

        isProcessing = true;

        try {
            const mimeType =
                mediaRecorder?.mimeType || "audio/webm";

            const audioBlob = new Blob(audioChunks, {
                type: mimeType
            });

            console.log(
                "Audio recorded:",
                audioBlob.size,
                "bytes"
            );

            setStatus("Transcribing...");

            const formData = new FormData();

            formData.append(
                "audio",
                audioBlob,
                "recording.webm"
            );

            /*
             * Your Flask backend should have:
             *
             * POST /transcribe
             *
             * receiving the file as "audio".
             */

            const response = await fetch("/transcribe", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(
                    `Server returned ${response.status}`
                );
            }

            const result = await response.json();

            console.log("Whisper transcription:", result);

            const text =
                result.text ||
                result.transcription ||
                result.transcript ||
                "";

            if (!text.trim()) {
                setStatus("No speech detected.");
                return;
            }

            putTranscriptionIntoInput(text);

            setStatus("Transcription complete.");

        } finally {
            isProcessing = false;
            audioChunks = [];
        }
    }

    // ------------------------------------------------------------
    // Put transcription into chat input
    // ------------------------------------------------------------

    function putTranscriptionIntoInput(text) {
        const input = findElement(
            "messageInput",
            "chatInput",
            "userInput",
            "prompt",
            "message"
        );

        if (!input) {
            console.warn(
                "Could not find the chat input element."
            );
            return;
        }

        /*
         * If the user already typed something,
         * add the transcription after it.
         */

        if (input.value.trim()) {
            input.value =
                input.value.trim() +
                " " +
                text.trim();
        } else {
            input.value = text.trim();
        }

        // Make sure other scripts notice the change
        input.dispatchEvent(
            new Event("input", {
                bubbles: true
            })
        );

        input.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );

        input.focus();
    }

    // ------------------------------------------------------------
    // Button appearance
    // ------------------------------------------------------------

    function updateButton(recording) {
        const button = findElement(
            "mic",
            "micButton",
            "mic-btn",
            "microphoneButton",
            "voiceButton",
            "recordButton"
        );

        if (!button) return;

        button.classList.toggle(
            "recording",
            recording
        );

        button.setAttribute(
            "aria-pressed",
            recording ? "true" : "false"
        );

        button.title = recording
            ? "Stop recording"
            : "Start voice input";
    }

    // ------------------------------------------------------------
    // Toggle recording
    // ------------------------------------------------------------

    async function toggleRecording() {
        if (isProcessing) {
            console.log(
                "Please wait for the current transcription."
            );
            return;
        }

        if (isRecording) {
            stopRecording();
        } else {
            await startRecording();
        }
    }

    // ------------------------------------------------------------
    // Automatically connect microphone button
    // ------------------------------------------------------------

    function connectButton() {
        const button = findElement(
            "mic",
            "micButton",
            "mic-btn",
            "microphoneButton",
            "voiceButton",
            "recordButton"
        );

        if (!button) {
            console.warn(
                "No microphone button found."
            );
            return;
        }

        // Prevent duplicate listeners
        if (button.dataset.slibstreamConnected === "true") {
            return;
        }

        button.dataset.slibstreamConnected = "true";

        button.addEventListener("click", async (event) => {
            event.preventDefault();
            await toggleRecording();
        });

        console.log(
            "Microphone button connected."
        );
    }

    // ------------------------------------------------------------
    // Public functions
    //
    // These are exposed globally so your existing HTML/script.js
    // can still call them if necessary.
    // ------------------------------------------------------------

    window.startWhisperRecording = startRecording;
    window.stopWhisperRecording = stopRecording;
    window.toggleWhisperRecording = toggleRecording;

    // Common aliases
    window.startRecording = startRecording;
    window.stopRecording = stopRecording;
    window.toggleRecording = toggleRecording;

    // ------------------------------------------------------------
    // Initialize
    // ------------------------------------------------------------

    function initialize() {
        console.log("Whisper: initializing...");

        connectButton();

        console.log("Whisper: ready.");
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }

})();