"use client";

import { AlertCircle, AlertTriangle, Bot, CheckCircle, Loader2, Mic, ScreenShare, User, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DS_QUESTIONS, SDE_QUESTIONS } from './questions';

// Helper component for displaying permission status
const PermissionStatus = ({ text, status }) => {
  const statusConfig = {
    pending: { icon: <AlertCircle className="h-5 w-5 text-yellow-400" />, textClass: 'text-yellow-400' },
    granted: { icon: <CheckCircle className="h-5 w-5 text-green-400" />, textClass: 'text-green-400' },
    denied: { icon: <XCircle className="h-5 w-5 text-red-400" />, textClass: 'text-red-400' },
  };

  const { icon, textClass } = statusConfig[status] || statusConfig.pending;
  const statusText = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="flex items-center space-x-3">
      {icon}
      <p className={`font-medium ${textClass}`}>{text}: {statusText}</p>
    </div>
  );
};


export default function Home() {
  const [stage, setStage] = useState('setup'); // setup, permissions, interview, end
  const [jobProfile, setJobProfile] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Updated permissions state
  const [permissions, setPermissions] = useState({
    camera: 'pending',
    screen: 'pending',
  });

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
    if (stage === 'permissions') {
      requestPermissions();
    }
    
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
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
      }
      if (window.faceapi) {
        loadFaceApiModels();
      }
    }).catch(err => {
      console.error(err);
      setError('Could not load necessary libraries. Please refresh the page.');
    });

    return () => {
      if (faceApiIntervalRef.current) clearInterval(faceApiIntervalRef.current);
    };
  }, [stage]);

  const loadFaceApiModels = async () => {
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
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

  const removeFile = () => {
    setResumeFile(null);
    setResumeText('');
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
        reader.onerror = () => reject(new Error("Failed to read file."));
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
    // Request Camera and Mic
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
      }
      setPermissions(prev => ({ ...prev, camera: 'granted' }));
    } catch (err) {
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      console.error("Camera/Mic permission error:", err);
    }

    // Request Screen Share
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" } });
      if (screenStream.getVideoTracks()[0].getSettings().displaySurface !== 'monitor') {
        screenStream.getTracks().forEach(track => track.stop());
        throw new Error("Please share your entire screen, not a window or tab.");
      }
      // We don't need to display the screen share, just get permission and stop tracks
      screenStream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, screen: 'granted' }));
    } catch (err) {
      setPermissions(prev => ({ ...prev, screen: 'denied' }));
      console.error("Screen Share permission error:", err);
    }
  };

  const startInterview = () => {
    if (permissions.camera !== 'granted' || permissions.screen !== 'granted') {
      setError("All permissions must be granted to start the interview.");
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
    if ('speechSynthesis' in window) {
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
    }
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

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleUserSpeech(transcript);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    recognition.onerror = (event) => console.error("Speech recognition error:", event.error);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    resetSilenceTimer();
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
        if (detections.length === 0) addWarning("No person detected in the camera.");
        else if (detections.length > 1) addWarning("Multiple people detected in the camera.");
      }
      if (document.hidden) addWarning("User switched tabs or minimized the window.");
    }, 5000);
  };

  const addWarning = (message) => {
    setWarnings(prev => {
      if (prev.some(w => w.message === message)) return prev;
      const newWarnings = [...prev, { message, time: new Date() }];
      if (newWarnings.length > 3) {
        endInterview("The interview has been terminated due to multiple violations.");
      }
      return newWarnings;
    });
  };

  const renderSetup = () => (
    <div className="w-full max-w-2xl mx-auto p-8 bg-card rounded-lg shadow-2xl border border-border">
      <h2 className="text-3xl font-bold text-center mb-2 text-foreground">AI Interview Assistant</h2>
      <p className="text-center text-accent mb-8">Upload your resume and specify the job profile to begin.</p>
      <div className="space-y-6">
        <div>
          <label htmlFor="job-profile" className="block text-sm font-medium text-accent mb-1 text-left">Job Profile</label>
          <input
            type="text"
            id="job-profile"
            value={jobProfile}
            onChange={(e) => setJobProfile(e.target.value)}
            placeholder="e.g., Senior SDE, Data Scientist"
            className="w-full bg-input border border-border rounded-md px-4 py-2 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-accent mb-1 text-left">Upload Resume (PDF)</label>
          {!resumeFile ? (
            <label htmlFor="file-upload" className="relative cursor-pointer mt-1 flex flex-col items-center justify-center w-full h-32 px-6 pt-5 pb-6 border-2 border-border border-dashed rounded-md hover:border-primary transition-colors">
              <div className="space-y-1 text-center">
                <p className="text-sm text-accent">Click to upload or drag and drop</p>
                <p className="text-xs text-accent/70">PDF (MAX. 10MB)</p>
              </div>
              <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf" />
            </label>
          ) : (
            <div className="mt-1 flex items-center justify-between w-full h-auto min-h-[5rem] px-4 py-2 bg-input border-2 border-primary rounded-md">
              <p className="text-sm text-foreground truncate">{resumeFile.name}</p>
              <button onClick={removeFile} className="text-accent hover:text-red-500 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
       {error && <p className="text-red-400 mt-4"><AlertTriangle className="inline mr-2 h-4 w-4" />{error}</p>}
      <div className="mt-8">
        <button
          onClick={proceedToPermissions}
          className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          disabled={!jobProfile || !resumeFile || isLoading}
        >
          {isLoading ? 'Processing...' : 'Proceed to System Check'}
        </button>
      </div>
    </div>
  );

  const renderPermissions = () => (
    <div className="w-full max-w-2xl mx-auto p-8 bg-card rounded-lg shadow-xl text-center border border-border">
      <h2 className="text-2xl font-bold mb-4">System & Permissions Check</h2>
      <p className="text-accent mb-6">We need to check your camera, microphone, and screen sharing.</p>
      <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-md bg-background mb-6 aspect-video"></video>
      <div className="space-y-4 text-left mb-8">
        <PermissionStatus text="Camera & Microphone" status={permissions.camera} />
        <PermissionStatus text="Screen Share" status={permissions.screen} />
      </div>
      <button
        onClick={startInterview}
        className="w-full bg-secondary hover:bg-secondary-hover text-white font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
        disabled={permissions.camera !== 'granted' || permissions.screen !== 'granted' || isLoading}
      >
        {isLoading ? 'Generating Questions...' : 'Start Interview'}
      </button>
    </div>
  );

  const renderInterview = () => (
    <div className="w-full h-screen flex flex-col p-4 gap-4">
      <div className="flex-grow flex gap-4">
        <div className="w-2/3 flex flex-col bg-card rounded-lg p-6 relative shadow-lg border border-border">
          <div className="flex items-center mb-4">
            <Bot className="h-8 w-8 text-secondary mr-3" />
            <h2 className="text-xl font-semibold">Interviewer</h2>
          </div>
          <div className="flex-grow flex items-center justify-center">
            {questions.length > 0 && (
              <p className="text-2xl text-center font-medium text-foreground animate-fade-in">
                {questions[currentQuestionIndex].question}
              </p>
            )}
          </div>
          
          {/* --- UPDATED SECTION START --- */}
          <div className="absolute bottom-6 left-6 flex items-center space-x-6">
            {/* Mic Status */}
            <div className="flex items-center space-x-2 text-accent">
              <Mic className={`h-5 w-5 flex-shrink-0 ${isListening ? 'text-green-400 animate-pulse' : ''}`} />
              <span className="whitespace-nowrap">{isListening ? 'Listening...' : 'Mic Idle'}</span>
            </div>
            {/* Bot Status */}
            <div className="flex items-center space-x-2 text-accent">
              {isBotSpeaking ? (
                <Loader2 className="h-5 w-5 animate-spin text-secondary flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 flex-shrink-0" /> // Placeholder to prevent layout shift
              )}
              <span className="whitespace-nowrap">{isBotSpeaking ? 'Speaking...' : 'Bot Idle'}</span>
            </div>
          </div>
          {/* --- UPDATED SECTION END --- */}

        </div>
        <div className="w-1/3 flex flex-col gap-4">
          <div className="bg-card rounded-lg p-2 flex-grow relative shadow-lg border border-border">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-md" />
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm flex items-center"><User className="h-4 w-4 mr-1" />Your Camera</div>
          </div>
          <div className="bg-card rounded-lg p-2 h-1/3 relative shadow-lg border border-border">
            <video ref={screenRef} autoPlay muted className="w-full h-full object-cover rounded-md" />
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm flex items-center"><ScreenShare className="h-4 w-4 mr-1" />Your Screen</div>
          </div>
        </div>
      </div>
      <div className="h-24 bg-card rounded-lg p-3 overflow-y-auto shadow-lg border border-border">
        <h3 className="text-sm font-semibold text-accent mb-2 flex items-center"><AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />Proctoring Warnings</h3>
        {warnings.length === 0 ? (
          <p className="text-sm text-accent">No warnings yet.</p>
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
    <div className="w-full max-w-2xl mx-auto p-8 bg-card rounded-lg shadow-xl text-center border border-border">
      <Bot size={48} className="mx-auto text-secondary mb-4" />
      <h1 className="text-3xl font-bold mb-2">Interview Finished</h1>
      <p className="text-accent mb-6">The interview has concluded. It was nice talking to you. Thank you!</p>
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-background">
      {stage === 'setup' && renderSetup()}
      {stage === 'permissions' && renderPermissions()}
      {stage === 'interview' && renderInterview()}
      {stage === 'end' && renderEnd()}
    </main>
  );
}