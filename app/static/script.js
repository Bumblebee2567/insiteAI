const textareaInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("send");
const AIResponse = document.getElementById("messages");

function scrollToBottom() {
    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
    });
}

function styleCodeBlocks(container) {

    container.querySelectorAll("pre > code").forEach(code => {

        const pre = code.parentElement;

        // Prevent processing the same code twice
        if (pre.parentElement.classList.contains("ai-code-block")) {
            return;
        }

        // Detect language
        let language = "Code";

        const languageClass = [...code.classList].find(cls =>
            cls.startsWith("language-")
        );

        if (languageClass) {
            language = languageClass
                .replace("language-", "")
                .toUpperCase();
        }

        // Create wrapper
        const wrapper = document.createElement("div");
        wrapper.className = "ai-code-block";

        // Header
        const header = document.createElement("div");
        header.className = "ai-code-header";

        const languageLabel = document.createElement("span");
        languageLabel.className = "ai-code-language";
        languageLabel.textContent = language;

        const copyButton = document.createElement("button");
        copyButton.className = "copy-code";
        copyButton.innerHTML =
            '<i class="fa-regular fa-copy"></i> Copy';

        // Copy function
        copyButton.addEventListener("click", async () => {

            try {

                await navigator.clipboard.writeText(code.textContent);

                copyButton.innerHTML =
                    '<i class="fa-solid fa-check"></i> Copied!';

                setTimeout(() => {
                    copyButton.innerHTML =
                        '<i class="fa-regular fa-copy"></i> Copy';
                }, 1500);

            } catch (error) {

                console.error("Copy failed:", error);

            }

        });

        header.appendChild(languageLabel);
        header.appendChild(copyButton);

        // Replace original <pre>
        pre.parentNode.insertBefore(wrapper, pre);

        wrapper.appendChild(header);
        wrapper.appendChild(pre);

    });
}

sendBtn.addEventListener("click", (e) => {
    e.preventDefault();

    let userHTML = `<div class="user_message">`;

    if (selectedFile && selectedFile.type.startsWith("image/")) {

        userHTML += `
            <img src="${URL.createObjectURL(selectedFile)}" class="chat-image">
        `;

    }

    if (textareaInput.value.trim() !== "") {

        const escapedText = textareaInput.value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        userHTML += `
            <span>${escapedText}</span>
        `;

    }

    userHTML += `</div>`;

    AIResponse.insertAdjacentHTML("beforeend", userHTML);

    scrollToBottom();


    // ==========================================
    // SAVE ORIGINAL MESSAGE FOR RETRY
    // ==========================================

    const retryMessage = textareaInput.value;
    const retryFile = selectedFile;


    // ==========================================
    // CREATE FORM DATA
    // ==========================================

    const formData = new FormData();

    formData.append(
        "message",
        textareaInput.value
    );

    if (selectedFile) {
        formData.append(
            "file",
            selectedFile
        );
    }


    // ==========================================
    // TYPING INDICATOR
    // ==========================================

    const typingDiv = document.createElement("div");

    typingDiv.className = "ai-message";
    typingDiv.id = "typingIndicator";

    typingDiv.innerHTML = `
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    AIResponse.appendChild(typingDiv);

    scrollToBottom();


    // ==========================================
    // SEND MESSAGE TO FLASK
    // ==========================================

    fetch("/send_message", {
        method: "POST",
        body: formData
    })

    .then(async response => {

        let data;

        try {
            data = await response.json();
        }

        catch (error) {

            throw new Error(
                "The server did not return a valid response."
            );
        }


        // Flask returned an error such as 400, 500, etc.
        if (!response.ok) {

            throw new Error(
                data.error ||
                "Insite AI could not process your message."
            );
        }


        return data;
    })

    .then(data => {

        const typing =
            document.getElementById("typingIndicator");

        if (typing) {
            typing.remove();
        }


        // ==========================================
        // MAKE SURE AI RETURNED AN ANSWER
        // ==========================================

        if (!data.answer) {

            showConnectionError(
                "Insite AI did not return an answer.",
                retryMessage,
                retryFile
            );

            return;
        }


        // ==========================================
        // YOUR ORIGINAL AI RESPONSE CODE
        // ==========================================

        const aiDiv = document.createElement("div");

        aiDiv.className = "ai-message";

        aiDiv.innerHTML = marked.parse(data.answer);

        styleCodeBlocks(aiDiv);

        AIResponse.appendChild(aiDiv);


        // ==========================================
        // YOUR ORIGINAL LATEX / MATH RENDERING
        // ==========================================

        renderMathInElement(aiDiv, {
            delimiters: [
                {
                    left: "$$",
                    right: "$$",
                    display: true
                },
                {
                    left: "$",
                    right: "$",
                    display: false
                }
            ]
        });


        scrollToBottom();


        // ==========================================
        // YOUR ORIGINAL INPUT RESET
        // ==========================================

        textareaInput.value = "";

        finalTranscript = "";

        selectedFile = null;

        cameraInput.value = "";

        imageInput.value = "";

        fileInput.value = "";

        imagePreview.innerHTML = "";

    })


    // ==========================================
    // CONNECTION / SERVER ERROR
    // ==========================================

    .catch(error => {

        console.error(
            "Message sending failed:",
            error
        );


        const typing =
            document.getElementById("typingIndicator");

        if (typing) {
            typing.remove();
        }


        showConnectionError(
            error.message ||
            "Unable to connect to Insite AI. Please check your internet connection and try again.",
            retryMessage,
            retryFile
        );

    });

});



// ==========================================
// CONNECTION ERROR MESSAGE
// ==========================================

function showConnectionError(
    errorMessage,
    originalMessage,
    originalFile
) {

    const errorDiv =
        document.createElement("div");

    errorDiv.className =
        "ai-message connection-error";


    errorDiv.innerHTML = `
        <div class="connection-error-content">

            <div class="connection-error-title">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Connection problem
            </div>

            <div class="connection-error-text">
                ${escapeHtml(errorMessage)}
            </div>

            <button
                type="button"
                class="retry-message"
            >
                <i class="fa-solid fa-rotate-right"></i>
                Retry
            </button>

        </div>
    `;


    AIResponse.appendChild(errorDiv);

    scrollToBottom();


    // ==========================================
    // RETRY BUTTON
    // ==========================================

    const retryButton =
        errorDiv.querySelector(".retry-message");


    retryButton.addEventListener("click", () => {

        // Remove old error message
        errorDiv.remove();


        // Create the form again
        const retryFormData = new FormData();

        retryFormData.append(
            "message",
            originalMessage
        );


        if (originalFile) {

            retryFormData.append(
                "file",
                originalFile
            );

        }


        // ==========================================
        // RETRY TYPING INDICATOR
        // ==========================================

        const retryTyping =
            document.createElement("div");

        retryTyping.className =
            "ai-message";

        retryTyping.id =
            "retryTypingIndicator";

        retryTyping.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        AIResponse.appendChild(retryTyping);

        scrollToBottom();


        // ==========================================
        // RETRY REQUEST
        // ==========================================

        fetch("/send_message", {
            method: "POST",
            body: retryFormData
        })

        .then(async response => {

            let data;

            try {
                data = await response.json();
            }

            catch (error) {

                throw new Error(
                    "The server did not return a valid response."
                );
            }


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Insite AI could not process your message."
                );
            }


            return data;
        })


        // ==========================================
        // RETRY SUCCESS
        // ==========================================

        .then(data => {

            const retryTypingIndicator =
                document.getElementById(
                    "retryTypingIndicator"
                );

            if (retryTypingIndicator) {
                retryTypingIndicator.remove();
            }


            if (!data.answer) {

                showConnectionError(
                    "Insite AI did not return an answer.",
                    originalMessage,
                    originalFile
                );

                return;
            }


            // ==========================================
            // SAME ORIGINAL AI RESPONSE PROCESSING
            // ==========================================

            const aiDiv =
                document.createElement("div");

            aiDiv.className =
                "ai-message";

            aiDiv.innerHTML =
                marked.parse(data.answer);

            styleCodeBlocks(aiDiv);

            AIResponse.appendChild(aiDiv);


            // ==========================================
            // SAME LATEX / MATH PROCESSING
            // ==========================================

            renderMathInElement(aiDiv, {
                delimiters: [
                    {
                        left: "$$",
                        right: "$$",
                        display: true
                    },
                    {
                        left: "$",
                        right: "$",
                        display: false
                    }
                ]
            });


            scrollToBottom();

        })


        // ==========================================
        // RETRY FAILED
        // ==========================================

        .catch(error => {

            console.error(
                "Retry failed:",
                error
            );


            const retryTypingIndicator =
                document.getElementById(
                    "retryTypingIndicator"
                );

            if (retryTypingIndicator) {
                retryTypingIndicator.remove();
            }


            showConnectionError(
                error.message ||
                "Still unable to connect to Insite AI. Please try again.",
                originalMessage,
                originalFile
            );

        });

    });
}



// ==========================================
// ESCAPE ERROR TEXT
// ==========================================

function escapeHtml(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}



// ==========================================
// GEMINI VOICE TRANSCRIPTION
// ==========================================

const micBtn = document.getElementById("mic");
const messageInput = document.getElementById("messageInput");

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;


// ------------------------------------------
// MIC BUTTON STATES
// ------------------------------------------

function setMicIdle() {
    isRecording = false;

    if (!micBtn) return;

    micBtn.disabled = false;
    micBtn.classList.remove("listening");

    micBtn.innerHTML = `
        <i class="fa-solid fa-microphone"></i>
    `;
}


function setMicRecording() {
    isRecording = true;

    if (!micBtn) return;

    micBtn.disabled = false;
    micBtn.classList.add("listening");

    micBtn.innerHTML = `
        <i class="fa-solid fa-stop"></i>
        <small class="voice-status">Tap to stop</small>
    `;
}


function setMicLoading() {
    if (!micBtn) return;

    micBtn.disabled = true;

    micBtn.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        <small class="voice-status">Transcribing...</small>
    `;
}


// ------------------------------------------
// START RECORDING
// ------------------------------------------

async function startRecording() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Your browser does not support microphone recording.");
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        audioChunks = [];

        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async function() {
            // Stop using the microphone
            stream.getTracks().forEach(track => track.stop());

            await sendAudioForTranscription();
        };

        mediaRecorder.start();

        setMicRecording();

        console.log("Voice recording started.");

    } catch (error) {
        console.error("Microphone error:", error);

        setMicIdle();

        alert(
            "Could not access your microphone. " +
            "Please allow microphone permission and try again."
        );
    }
}


// ------------------------------------------
// STOP RECORDING
// ------------------------------------------

function stopRecording() {
    if (!mediaRecorder) {
        return;
    }

    if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();

        setMicLoading();
    }
}


// ------------------------------------------
// SEND AUDIO TO FLASK
// ------------------------------------------

async function sendAudioForTranscription() {
    try {
        if (audioChunks.length === 0) {
            console.error("No audio was recorded.");
            setMicIdle();
            return;
        }

        const audioBlob = new Blob(
            audioChunks,
            {
                type: "audio/webm"
            }
        );

        const formData = new FormData();

        formData.append(
            "audio",
            audioBlob,
            "recording.webm"
        );

        console.log("Sending audio to /transcribe...");

        const response = await fetch("/transcribe", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error || "Transcription failed."
            );
        }

        console.log(
            "Gemini transcription:",
            data.text
        );

        // Put the transcription into the chat box
        if (messageInput) {
            const existingText = messageInput.value.trim();

        if (existingText) {
            messageInput.value = existingText + " " + data.text;
        } else {
            messageInput.value = data.text;
        }

            // Make sure the textarea grows correctly
            messageInput.dispatchEvent(
                new Event("input", {
                    bubbles: true
                })
            );

            messageInput.focus();
        }

    } catch (error) {
        console.error(
            "Transcription error:",
            error
        );

        alert(
            "Sorry, I couldn't transcribe that recording."
        );

    } finally {
        audioChunks = [];
        mediaRecorder = null;

        setMicIdle();
    }
}


// ------------------------------------------
// MICROPHONE BUTTON
// ------------------------------------------

if (micBtn) {

    micBtn.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            if (!isRecording) {
                startRecording();
            } else {
                stopRecording();
            }

        }
    );

}

const imageBtn = document.getElementById("image");
const attachmentMenu = document.getElementById("attachment-menu");

imageBtn.addEventListener("click", (e) => {

    e.stopPropagation();

    attachmentMenu.classList.toggle("show");

});

document.addEventListener("click", (e) => {

    if (
        !attachmentMenu.contains(e.target) &&
        e.target !== imageBtn
    ) {
        attachmentMenu.classList.remove("show");
    }

});

const takePhoto = document.getElementById("takePhoto");
const uploadImage = document.getElementById("uploadImage");
const browseFiles = document.getElementById("browseFiles");

const cameraInput = document.getElementById("cameraInput");
const imageInput = document.getElementById("imageInput");
const fileInput = document.getElementById("fileInput");


// ==========================================
// UNIFIED TAKE PHOTO / WEBCAM LOGIC
// ==========================================

const webcamModal = document.getElementById("webcamModal");
const webcamVideo = document.getElementById("webcamVideo");
const webcamCanvas = document.getElementById("webcamCanvas");
const captureWebcamBtn = document.getElementById("captureWebcamBtn");
const closeWebcamModal = document.getElementById("closeWebcamModal");

let webcamStream = null;

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

takePhoto.addEventListener("click", async () => {
    attachmentMenu.classList.remove("show");

    // 📱 MOBILE: Use native phone camera app
    if (isMobileDevice()) {
        cameraInput.click();
        return;
    }

    // 💻 DESKTOP: Open live webcam modal stream
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            cameraInput.click();
            return;
        }

        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: false
        });

        webcamVideo.srcObject = webcamStream;
        if (webcamModal) {
            webcamModal.style.display = "flex";
        }

    } catch (error) {
        console.log("Webcam unavailable, falling back to camera input:", error);
        cameraInput.click();
    }
});

if (captureWebcamBtn) {
    captureWebcamBtn.addEventListener("click", () => {
        if (!webcamStream) return;

        const context = webcamCanvas.getContext("2d");
        webcamCanvas.width = webcamVideo.videoWidth;
        webcamCanvas.height = webcamVideo.videoHeight;
        
        context.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);

        webcamCanvas.toBlob((blob) => {
            selectedFile = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" });
            closeWebcam();
            showPreview();
        }, "image/jpeg", 0.95);
    });
}

function closeWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (webcamModal) {
        webcamModal.style.display = "none";
    }
}

if (closeWebcamModal) {
    closeWebcamModal.addEventListener("click", closeWebcam);
}

if (webcamModal) {
    webcamModal.addEventListener("click", (e) => {
        if (e.target === webcamModal) {
            closeWebcam();
        }
    });
}


// Upload Image
uploadImage.addEventListener("click", () => {

    imageInput.click();

});

// Browse Any File
browseFiles.addEventListener("click", () => {

    fileInput.click();

});

function showPreview() {

    if (!selectedFile) return;

    const fileType = selectedFile.type;
    const fileName = selectedFile.name;

    // IMAGE
    if (fileType.startsWith("image/")) {

        const imageURL =
            URL.createObjectURL(selectedFile);

        imagePreview.innerHTML = `
            <div class="preview-card">

                <img
                    src="${imageURL}"
                    alt="${fileName}"
                >

                <button
                    class="remove-image"
                    id="removeImage"
                    type="button">
                    ✕
                </button>

            </div>
        `;

    }

    // NON-IMAGE FILE
    else {

        imagePreview.innerHTML = `
            <div class="file-preview-card">

                <i class="fa-solid fa-file"></i>

                <span title="${fileName}">
                    ${fileName}
                </span>

                <button
                    class="remove-image"
                    id="removeImage"
                    type="button">
                    ✕
                </button>

            </div>
        `;

    }

    document
        .getElementById("removeImage")
        .addEventListener("click", () => {

            selectedFile = null;

            imagePreview.innerHTML = "";

            cameraInput.value = "";
            imageInput.value = "";
            fileInput.value = "";

        });

}

let selectedFile = null;

const imagePreview = document.getElementById("imagePreview");

cameraInput.addEventListener("change", (e) => {

    selectedFile = e.target.files[0];
    attachmentMenu.classList.remove("show");
    showPreview();

});


imageInput.addEventListener("change", (e) => {

    selectedFile = e.target.files[0];
    attachmentMenu.classList.remove("show");
    showPreview();

});


fileInput.addEventListener("change", (e) => {

    selectedFile = e.target.files[0];
    attachmentMenu.classList.remove("show");
    showPreview();

});

window.addEventListener("load", () => {

    document.querySelectorAll(".ai-message").forEach(msg => {

        const markdown = msg.textContent.trim();

        msg.innerHTML = marked.parse(markdown);

        // Apply the same code-box styling
        // used for newly generated responses
        styleCodeBlocks(msg);

        renderMathInElement(msg, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true }
            ],
            throwOnError: false
        });

    });

    scrollToBottom();

});

function styleCodeBlocks(container) {

    container.querySelectorAll("pre > code").forEach(code => {

        const pre = code.parentElement;

        // Prevent duplicate processing
        if (
            pre.parentElement &&
            pre.parentElement.classList.contains("ai-code-block")
        ) {
            return;
        }

        // Detect language
        let language = "Code";

        const languageClass = [...code.classList].find(cls =>
            cls.startsWith("language-")
        );

        if (languageClass) {

            language = languageClass
                .replace("language-", "")
                .toUpperCase();

        }


        // ==========================================
        // CODE BLOCK
        // ==========================================

        const wrapper =
            document.createElement("div");

        wrapper.className =
            "ai-code-block";


        // ==========================================
        // HEADER
        // ==========================================

        const header =
            document.createElement("div");

        header.className =
            "ai-code-header";


        // ==========================================
        // LANGUAGE
        // ==========================================

        const languageLabel =
            document.createElement("span");

        languageLabel.className =
            "ai-code-language";

        languageLabel.textContent =
            language;


        // ==========================================
        // RIGHT-SIDE ACTIONS
        // ==========================================

        const actions =
            document.createElement("div");

        actions.className =
            "ai-code-actions";


        // ==========================================
        // COPY BUTTON
        // ==========================================

        const copyButton =
            document.createElement("button");

        copyButton.type =
            "button";

        copyButton.className =
            "copy-code";

        copyButton.innerHTML =
            '<i class="fa-regular fa-copy"></i> Copy';


        copyButton.addEventListener(
            "click",
            async () => {

                try {

                    await navigator.clipboard.writeText(
                        code.textContent
                    );

                    copyButton.innerHTML =
                        '<i class="fa-solid fa-check"></i> Copied!';


                    setTimeout(() => {

                        copyButton.innerHTML =
                            '<i class="fa-regular fa-copy"></i> Copy';

                    }, 1500);

                } catch (error) {

                    console.error(
                        "Copy failed:",
                        error
                    );

                }

            }
        );


        actions.appendChild(
            copyButton
        );


        // ==========================================
        // HTML PREVIEW BUTTON
        // ==========================================

        const detectedLanguage =
            language.toLowerCase();

        if (
            detectedLanguage === "html" ||
            detectedLanguage === "html5" ||
            detectedLanguage === "xhtml"
        ) {

            const previewButton =
                document.createElement("button");

            previewButton.type =
                "button";

            previewButton.className =
                "insite-html-preview-btn";

            previewButton.innerHTML =
                '<i class="fa-solid fa-eye"></i> Preview';


            previewButton.addEventListener(
                "click",
                () => {

                    openHTMLPreview(
                        code.textContent
                    );

                }
            );


            actions.appendChild(
                previewButton
            );

        }


        // ==========================================
        // BUILD HEADER
        // ==========================================

        header.appendChild(
            languageLabel
        );

        header.appendChild(
            actions
        );


        // ==========================================
        // BUILD CODE BLOCK
        // ==========================================

        pre.parentNode.insertBefore(
            wrapper,
            pre
        );

        wrapper.appendChild(
            header
        );

        wrapper.appendChild(
            pre
        );

    });

}


/* =========================================================
   INSITE AI — HTML PREVIEW
   ========================================================= */

function openHTMLPreview(html) {

    // Remove existing preview
    const existingPreview =
        document.getElementById(
            "insiteHTMLPreview"
        );

    if (existingPreview) {
        existingPreview.remove();
    }


    // ==========================================
    // OVERLAY
    // ==========================================

    const overlay =
        document.createElement("div");

    overlay.id =
        "insiteHTMLPreview";

    overlay.className =
        "insite-html-preview-overlay";


    // ==========================================
    // WINDOW
    // ==========================================

    const windowBox =
        document.createElement("div");

    windowBox.className =
        "insite-html-preview-window";


    // ==========================================
    // HEADER
    // ==========================================

    const header =
        document.createElement("div");

    header.className =
        "insite-html-preview-header";


    // Title
    const title =
        document.createElement("div");

    title.className =
        "insite-preview-title";

    title.innerHTML =
        '<i class="fa-solid fa-globe"></i>' +
        '<span>HTML Preview</span>';


    // Actions
    const previewActions =
        document.createElement("div");

    previewActions.className =
        "insite-preview-actions";


    // ==========================================
    // RELOAD
    // ==========================================

    const reloadButton =
        document.createElement("button");

    reloadButton.type =
        "button";

    reloadButton.className =
        "insite-preview-reload";

    reloadButton.title =
        "Reload preview";

    reloadButton.innerHTML =
        '<i class="fa-solid fa-rotate-right"></i>';


    // ==========================================
    // CLOSE
    // ==========================================

    const closeButton =
        document.createElement("button");

    closeButton.type =
        "button";

    closeButton.className =
        "insite-preview-close";

    closeButton.title =
        "Close preview";

    closeButton.innerHTML =
        '<i class="fa-solid fa-xmark"></i>';


    previewActions.appendChild(
        reloadButton
    );

    previewActions.appendChild(
        closeButton
    );


    header.appendChild(
        title
    );

    header.appendChild(
        previewActions
    );


    // ==========================================
    // PREVIEW BODY
    // ==========================================

    const body =
        document.createElement("div");

    body.className =
        "insite-html-preview-body";


    // ==========================================
    // IFRAME
    // ==========================================

    const iframe =
        document.createElement("iframe");

    iframe.className =
        "insite-html-preview-frame";

    iframe.title =
        "HTML Preview";

    iframe.setAttribute(
        "frameborder",
        "0"
    );

    iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-forms allow-modals"
    );


    body.appendChild(
        iframe
    );


    // ==========================================
    // ASSEMBLE
    // ==========================================

    windowBox.appendChild(
        header
    );

    windowBox.appendChild(
        body
    );

    overlay.appendChild(
        windowBox
    );

    document.body.appendChild(
        overlay
    );


    // ==========================================
    // RENDER
    // ==========================================

    let blobURL = null;

    function renderPreview() {

        if (blobURL) {

            URL.revokeObjectURL(
                blobURL
            );

        }

        const blob =
            new Blob(
                [html],
                {
                    type: "text/html"
                }
            );

        blobURL =
            URL.createObjectURL(
                blob
            );

        iframe.src =
            blobURL;

    }


    renderPreview();


    // ==========================================
    // CLOSE FUNCTION
    // ==========================================

    function closePreview() {

        if (blobURL) {

            URL.revokeObjectURL(
                blobURL
            );

            blobURL = null;

        }

        overlay.remove();

        document.removeEventListener(
            "keydown",
            escapeHandler
        );

    }


    // ==========================================
    // RELOAD
    // ==========================================

    reloadButton.addEventListener(
        "click",
        () => {

            renderPreview();

        }
    );


    // ==========================================
    // CLOSE
    // ==========================================

    closeButton.addEventListener(
        "click",
        closePreview
    );


    // ==========================================
    // CLICK OUTSIDE
    // ==========================================

    overlay.addEventListener(
        "click",
        event => {

            if (
                event.target === overlay
            ) {

                closePreview();

            }

        }
    );


    // ==========================================
    // ESC
    // ==========================================

    function escapeHandler(event) {

        if (
            event.key === "Escape"
        ) {

            closePreview();

        }

    }


    document.addEventListener(
        "keydown",
        escapeHandler
    );

}
