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
            <img src="${URL.createObjectURL(selectedFile)}"class="chat-image">
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
    const formData = new FormData();

    formData.append("message", textareaInput.value);

    if (selectedFile) {
        formData.append("file", selectedFile);
    }

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

    fetch("/send_message", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {

        const typing = document.getElementById("typingIndicator");

        if (typing) {
            typing.remove();
        }

        const aiDiv = document.createElement("div");
        aiDiv.className = "ai-message";
        aiDiv.innerHTML = marked.parse(data.answer);

        styleCodeBlocks(aiDiv);

        AIResponse.appendChild(aiDiv);

        renderMathInElement(aiDiv, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false }
            ]
        });

        scrollToBottom();

        textareaInput.value = "";
        finalTranscript = "";
        selectedFile = null;
        cameraInput.value = "";
        imageInput.value = "";
        fileInput.value = "";
        imagePreview.innerHTML = "";

    })
    .catch((error) => {
        console.error(error)
        const typing = document.getElementById("typingIndicator");

        if (typing) {
            typing.remove();
        }
    });
});


const micBtn = document.getElementById("mic");

let isListening = false;
let recognition;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    micBtn.addEventListener("click", () => {

        if (!isListening) {

            finalTranscript = "";
            textareaInput.value = "";

            recognition.start();
            isListening = true;

            micBtn.innerHTML = `
                <i class="fa-solid fa-circle-dot"></i>
                <small class="voice-status">Tap to stop listening</small>
            `;

            micBtn.classList.add("listening");

        } else {

            recognition.stop();
            isListening = false;

            micBtn.innerHTML = `
                <i class="fa-solid fa-microphone"></i>
            `;

            micBtn.classList.remove("listening");
        }

    });
    let finalTranscript = "";

    recognition.onresult = (event) => {

        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {

            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + " ";
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        textareaInput.value = finalTranscript + interimTranscript;
    };

    recognition.onend = () => {

        if (isListening) {
            setTimeout(() => {
            recognition.start();
        }, 200);

    }

};

    recognition.onerror = () => {

        isListening = false;

        micBtn.innerHTML = `
            <i class="fa-solid fa-microphone"></i>
        `;

        micBtn.classList.remove("listening");

    };

} else {

    alert("Your browser does not support Speech Recognition.");

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

// Open Camera
takePhoto.addEventListener("click", async () => {

    attachmentMenu.classList.remove("show");

    // Browser cannot access camera API
    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        fileInput.click();

        return;
    }

    try {

        // Actually check whether a camera is available
        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

        // Camera exists.
        // We only needed the stream to test availability.
        stream.getTracks().forEach(track => {
            track.stop();
        });

        // Now open the camera input
        cameraInput.click();

    } catch (error) {

        console.log("Camera unavailable:", error.name);

        // No camera / permission denied / unavailable
        fileInput.click();

    }

});

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