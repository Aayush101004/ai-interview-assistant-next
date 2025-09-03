"use client";

import { AlertTriangle, Bot, CheckCircle, Loader2, Mic, ScreenShare, Upload, User, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DS_QUESTIONS, SDE_QUESTIONS } from './questions';

export default function Home() {
  const [stage, setStage] = useState('setup'); // setup, permissions, interview, end
  const [jobProfile, setJobProfile] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Permissions State
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);

  // Interview State
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);

  // Proctoring State
  const [warnings, setWarnings] = useState([]);

  // Refs
  const videoRef = useRef(null);
  const screenRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const faceApiIntervalRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // Load external scripts
  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(`Failed to load script: ${src}`);
        document.body.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'),
    ]).then(() => {
      console.log('External scripts loaded');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
      loadFaceApiModels();
    }).catch(err => {
      console.error(err);
      setError('Could not load necessary libraries. Please refresh the page.');
    });

    return () => {
      if (faceApiIntervalRef.current) clearInterval(faceApiIntervalRef.current);
    };
  }, []);

  const loadFaceApiModels = async () => {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
    try {
      setIsLoading(true);
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
    } catch (e) {
      setError("Failed to load AI proctoring models. Please check your connection and refresh.");
      console.error("Model loading error:", e);
    } finally {
      setIsLoading(false);
    }
  };


  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf" && file.size < 10 * 1024 * 1024) {
      setResumeFile(file);
      setError('');
    } else {
      setResumeFile(null);
      setError("Please upload a PDF file smaller than 10MB.");
    }
  };

  const parseResume = async () => {
    if (!resumeFile) return;
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const pdfData = new Uint8Array(event.target.result);
          const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
          let textContent = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            textContent += text.items.map(s => s.str).join(' ');
          }
          setResumeText(textContent);
          resolve();
        };
        reader.onerror = () => {
          reject(new Error("Failed to read file."));
        };
        reader.readAsArrayBuffer(resumeFile);
      } catch (e) {
        reject(e);
      }
    });
  };

  const proceedToPermissions = async () => {
    if (!jobProfile.trim() || !resumeFile) {
      setError("Please specify a job profile and upload your resume.");
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await parseResume();
      setStage('permissions');
    } catch (e) {
      setError("Failed to parse resume. Please try another file.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      // Camera
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        setCameraEnabled(true);
      }

      // Screen Share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" } });
      if (screenStream.getVideoTracks()[0].getSettings().displaySurface !== 'monitor') {
        screenStream.getTracks().forEach(track => track.stop());
        throw new Error("Please share your entire screen, not a window or tab.");
      }
      if (screenRef.current) {
        screenRef.current.srcObject = screenStream;
        setScreenShareEnabled(true);
      }

    } catch (err) {
      setError(`Permission denied: ${err.message}. Please enable camera and entire screen sharing in your browser settings to continue.`);
      setCameraEnabled(false);
      setScreenShareEnabled(false);
    }
  };

  const startInterview = () => {
    if (!cameraEnabled || !screenShareEnabled) {
      setError("Camera and Screen Sharing must be enabled to start.");
      return;
    }
    setStage('interview');
    generateQuestions();
    startProctoring();
  };

  const generateQuestions = () => {
    let questionPool = [];
    if (jobProfile.toLowerCase().includes('sde') || jobProfile.toLowerCase().includes('software developer')) {
      questionPool = SDE_QUESTIONS;
    } else if (jobProfile.toLowerCase().includes('data scientist') || jobProfile.toLowerCase().includes('analyst')) {
      questionPool = DS_QUESTIONS;
    } else {
      questionPool = [...SDE_QUESTIONS, ...DS_QUESTIONS].filter((v, i, a) => a.findIndex(t => (t.question === v.question)) === i);
    }

    const resumeKeywords = {
      'react': { question: "Tell me about your experience with React and describe a challenging project you built with it.", type: "Technical" },
      'python': { question: "I see you have experience with Python. Can you explain the difference between a list and a tuple?", type: "Technical" },
      'sql': { question: "Your resume mentions SQL. Can you describe a complex query you've written?", type: "Technical" },
      'machine learning': { question: "You've listed Machine Learning. Can you explain a project where you implemented an ML model from scratch?", type: "Technical" }
    };

    Object.keys(resumeKeywords).forEach(key => {
      if (resumeText.toLowerCase().includes(key)) {
        questionPool.unshift(resumeKeywords[key]);
      }
    });

    const shuffled = [...questionPool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.floor(Math.random() * (6 - 3 + 1)) + 3);

    const finalQuestions = [
      { question: "To start, please introduce yourself and walk me through your resume.", type: "Introductory" },
      ...selected,
    ];

    if (jobProfile.toLowerCase().includes('sde')) {
      finalQuestions.push({ question: "Let's move to a coding problem. Please explain your approach and then write a C++ function to reverse a linked list.", type: "Coding" });
    } else if (jobProfile.toLowerCase().includes('data scientist')) {
      finalQuestions.push({ question: "For the coding section, please use Python to write a function that finds the mode of a list of numbers.", type: "Coding" });
    }

    setQuestions(finalQuestions);
  };

  useEffect(() => {
    if (stage === 'interview' && questions.length > 0 && !isBotSpeaking) {
      askQuestion(questions[currentQuestionIndex].question);
    }
  }, [stage, questions, currentQuestionIndex]);

  const askQuestion = (text) => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsBotSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      setIsBotSpeaking(false);
      startListening();
    };
    speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      console.error("Speech recognition not supported.");
      resetSilenceTimer();
      return;
    }

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    speechRecognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      resetSilenceTimer();
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleUserSpeech(transcript);
      clearTimeout(silenceTimerRef.current);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      handleNextQuestion(true);
    }, 6000);
  };

  const handleUserSpeech = (transcript) => {
    const lowerTranscript = transcript.toLowerCase();
    if (lowerTranscript.includes("don't understand") || lowerTranscript.includes("repeat the question") || lowerTranscript.includes("pardon")) {
      const simplerQuestion = `Of course. Let me rephrase: ${questions[currentQuestionIndex].question.replace(/\b(describe|explain|walk me through)\b/gi, 'tell me about')}`;
      askQuestion(simplerQuestion);
    } else if (lowerTranscript.includes("skip") || lowerTranscript.includes("don't know")) {
      handleNextQuestion(true);
    } else {
      handleNextQuestion(false);
    }
  };

  const handleNextQuestion = (isUnanswered = false) => {
    const newUnansweredCount = unansweredCount + (isUnanswered ? 1 : 0);
    if (isUnanswered) {
      setUnansweredCount(newUnansweredCount);
    }

    if (newUnansweredCount >= 3) {
      endInterview("Thank you for your time. It was nice talking to you.");
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      endInterview("That was the last question. Thank you for completing the interview!");
    }
  };

  const endInterview = (message) => {
    setStage('end');
    askQuestion(message);
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    if (screenRef.current && screenRef.current.srcObject) {
      screenRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    if (faceApiIntervalRef.current) clearInterval(faceApiIntervalRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (speechRecognitionRef.current) speechRecognitionRef.current.stop();

  };

  const startProctoring = () => {
    faceApiIntervalRef.current = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && window.faceapi) {
        const detections = await window.faceapi.detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions());

        if (detections.length === 0) {
          addWarning("No person detected in the camera.");
        } else if (detections.length > 1) {
          addWarning("Multiple people detected in the camera.");
        }
      }
      if (document.hidden) {
        addWarning("User switched tabs or minimized the window.");
      }
    }, 5000);
  };

  const addWarning = (message) => {
    setWarnings(prev => {
      const newWarnings = [...prev, { message, time: new Date() }];
      if (newWarnings.length > 3) {
        endInterview("The interview has been terminated due to multiple violations.");
      }
      return newWarnings;
    });
  };

  const renderSetup = () => (
    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-2xl text-center animate-fade-in">
      <Bot size={48} className="mx-auto text-blue-400 mb-4" />
      <h1 className="text-3xl font-bold mb-2">AI Interview Assistant</h1>
      <p className="text-gray-400 mb-6">Upload your resume and specify the job profile to begin.</p>

      <div className="space-y-6 text-left">
        <div>
          <label htmlFor="job-profile" className="block text-sm font-medium text-gray-300 mb-1">Job Profile</label>
          <input
            type="text"
            id="job-profile"
            value={jobProfile}
            onChange={(e) => setJobProfile(e.target.value)}
            placeholder="e.g., Senior SDE, Data Scientist"
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Upload Resume (PDF)</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-500" />
              <div className="flex text-sm text-gray-400">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-700 rounded-md font-medium text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-blue-500 px-2">
                  <span>Click to upload</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">PDF (MAX. 10MB)</p>
            </div>
          </div>
          {resumeFile && <p className="text-sm text-green-400 mt-2 text-center">File selected: {resumeFile.name}</p>}
        </div>
      </div>

      {error && <p className="text-red-400 mt-4"><AlertTriangle className="inline mr-2 h-4 w-4" />{error}</p>}

      <button
        onClick={proceedToPermissions}
        disabled={isLoading}
        className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-500 flex items-center justify-center"
      >
        {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {isLoading ? 'Analyzing...' : 'Proceed to System Check'}
      </button>
    </div>
  );

  const renderPermissions = () => (
    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-2xl text-center animate-fade-in">
      <h2 className="text-2xl font-bold mb-4">System Check</h2>
      <p className="text-gray-400 mb-6">We need access to your camera and screen for the interview.</p>
      <div className="flex flex-col md:flex-row gap-4 justify-center items-center my-6">
        <div className="w-full md:w-1/2 p-4 bg-gray-700 rounded-lg">
          <Video className={`mx-auto h-12 w-12 ${cameraEnabled ? 'text-green-400' : 'text-gray-500'}`} />
          <p className="mt-2">Camera Access</p>
          {cameraEnabled && <CheckCircle className="mx-auto mt-1 h-6 w-6 text-green-400" />}
        </div>
        <div className="w-full md:w-1/2 p-4 bg-gray-700 rounded-lg">
          <ScreenShare className={`mx-auto h-12 w-12 ${screenShareEnabled ? 'text-green-400' : 'text-gray-500'}`} />
          <p className="mt-2">Entire Screen Share</p>
          {screenShareEnabled && <CheckCircle className="mx-auto mt-1 h-6 w-6 text-green-400" />}
        </div>
      </div>

      <video ref={videoRef} autoPlay muted playsInline className="hidden" />
      <video ref={screenRef} autoPlay muted className="hidden" />

      {error && <p className="text-red-400 mt-4"><AlertTriangle className="inline mr-2 h-4 w-4" />{error}</p>}

      {(!cameraEnabled || !screenShareEnabled) && (
        <button onClick={requestPermissions} className="w-full mt-4 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-md transition duration-300">
          Enable Permissions
        </button>
      )}
      <button
        onClick={startInterview}
        disabled={!cameraEnabled || !screenShareEnabled}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        Start Interview
      </button>
    </div>
  );

  const renderInterview = () => (
    <div className="w-full h-screen flex flex-col p-4 gap-4">
      {/* Main Content */}
      <div className="flex-grow flex gap-4">
        <div className="w-2/3 flex flex-col bg-gray-800 rounded-lg p-6 relative shadow-lg">
          <div className="flex items-center mb-4">
            <Bot className="h-8 w-8 text-blue-400 mr-3" />
            <h2 className="text-xl font-semibold">Interviewer</h2>
          </div>
          <div className="flex-grow flex items-center justify-center">
            {questions.length > 0 && (
              <p className="text-2xl text-center font-medium text-gray-100 animate-fade-in">
                {questions[currentQuestionIndex].question}
              </p>
            )}
          </div>
          <div className="absolute bottom-4 left-6 flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Mic className={`h-5 w-5 ${isListening ? 'text-green-400 animate-pulse' : ''}`} />
              <span>{isListening ? 'Listening...' : 'Mic Idle'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              {isBotSpeaking ? <Loader2 className="h-5 w-5 animate-spin text-blue-400" /> : <div className="w-5 h-5" />}
              <span>{isBotSpeaking ? 'Speaking...' : 'Bot Idle'}</span>
            </div>
          </div>
        </div>

        <div className="w-1/3 flex flex-col gap-4">
          <div className="bg-gray-800 rounded-lg p-2 flex-grow relative shadow-lg">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-md" />
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm flex items-center"><User className="h-4 w-4 mr-1" />Your Camera</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 h-1/3 relative shadow-lg">
            <video ref={screenRef} autoPlay muted className="w-full h-full object-cover rounded-md" />
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm flex items-center"><ScreenShare className="h-4 w-4 mr-1" />Your Screen</div>
          </div>
        </div>
      </div>
      <div className="h-24 bg-gray-800 rounded-lg p-3 overflow-y-auto shadow-lg">
        <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center"><AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />Proctoring Warnings</h3>
        {warnings.length === 0 ? (
          <p className="text-sm text-gray-500">No warnings yet.</p>
        ) : (
          <ul className="text-xs text-yellow-400 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w.time.toLocaleTimeString()}: {w.message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const renderEnd = () => (
    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-2xl text-center animate-fade-in">
      <Bot size={48} className="mx-auto text-blue-400 mb-4" />
      <h1 className="text-3xl font-bold mb-2">Interview Finished</h1>
      <p className="text-gray-400 mb-6">
        The interview has concluded. It was nice talking to you. Thank you!
      </p>
    </div>
  );


  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      {stage === 'setup' && renderSetup()}
      {stage === 'permissions' && renderPermissions()}
      {stage === 'interview' && renderInterview()}
      {stage === 'end' && renderEnd()}
    </main>
  );
}