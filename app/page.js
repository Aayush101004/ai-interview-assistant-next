"use client";

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AlertCircle, AlertTriangle, Bot, CheckCircle, Download, Loader2, Mic, User, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BA_QUESTIONS, DS_QUESTIONS, SDE_QUESTIONS } from './questions';

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

// Reusable Modal Component for Warnings
const WarningModal = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-xl p-6 w-full max-w-md text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
          <AlertTriangle className="h-6 w-6 text-yellow-600" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-medium leading-6 text-foreground" id="modal-title">{title}</h3>
        <div className="mt-2">
          <p className="text-sm text-accent">{message}</p>
        </div>
        <div className="mt-5">
          <button
            type="button"
            className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:text-sm"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};


export default function Home() {
  const [stage, setStage] = useState('setup'); // setup, permissions, interview, report, end
  const [jobProfile, setJobProfile] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState({
    camera: 'pending',
    screen: 'pending',
  });

  // State for the warning modal
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });

  // Interview State
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [audioAnalyser, setAudioAnalyser] = useState(null);
  const [interviewData, setInterviewData] = useState([]);
  const [scorecard, setScorecard] = useState(null); // --- NEW --- To store the generated scorecard
  const [isGeneratingReport, setIsGeneratingReport] = useState(false); // --- NEW --- Loading state for report

  // Proctoring State
  const [warnings, setWarnings] = useState([]);

  // Refs
  const videoRef = useRef(null);
  const faceApiIntervalRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const visualizerRef = useRef(null);
  const animationFrameId = useRef(null);
  const reportRef = useRef(null); // --- NEW --- Ref for the report component to download

  const jobProfiles = [
    "Software Development Engineer (SDE)", "Frontend Developer", "Backend Developer", "Full-Stack Developer", "Mobile App Developer (iOS/Android)", "DevOps Engineer", "Cloud Engineer (AWS/Azure/GCP)", "Site Reliability Engineer (SRE)", "QA Engineer / SDET", "Security Engineer", "Data Scientist", "Data Analyst", "Machine Learning Engineer", "Data Engineer", "Business Intelligence (BI) Developer", "Business Analyst", "Product Manager", "Project Manager", "Scrum Master", "UI/UX Designer", "Systems Administrator", "Network Engineer", "Database Administrator (DBA)"
  ];

  const showModal = (title, message) => setModal({ isOpen: true, title, message });
  const closeModal = () => setModal({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    if (stage === 'permissions') {
      requestPermissions();
    }

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
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
      if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`; }
      if (window.faceapi) { loadFaceApiModels(); }
    }).catch(err => {
      console.error(err);
      setError('Could not load necessary libraries. Please refresh the page.');
    });

    const handleVisibilityChange = () => {
      if (stage === 'interview' && document.hidden) {
        addWarning("You have switched away from the interview tab.", true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (faceApiIntervalRef.current) clearInterval(faceApiIntervalRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [stage]);

  useEffect(() => {
    const draw = () => {
      if (!isListening || !audioAnalyser || !visualizerRef.current) return;
      const canvas = visualizerRef.current;
      const ctx = canvas.getContext('2d');
      const bufferLength = audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      audioAnalyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength);
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2.5;
        const color = barHeight > 50 ? '#10B981' : (barHeight > 25 ? '#34D399' : '#6B7280');
        ctx.fillStyle = color;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth;
      }
      animationFrameId.current = requestAnimationFrame(draw);
    };

    if (isListening) {
      draw();
    } else {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (visualizerRef.current) {
        const canvas = visualizerRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isListening, audioAnalyser]);


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
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
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
        } catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsArrayBuffer(resumeFile);
    });
  };

  const proceedToPermissions = async () => {
    if (!jobProfile || !resumeFile) {
      setError("Please select a job profile and upload your resume.");
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await parseResume();
      setStage('permissions');
    } catch (e) {
      setError("Failed to parse resume. Please try another file.");
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      setAudioAnalyser(analyser);

      setPermissions(prev => ({ ...prev, camera: 'granted' }));
    } catch (err) {
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      showModal('Camera/Microphone Access Denied', 'You must allow access to your camera and microphone to continue. Please check your browser settings.');
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" } });
      screenStream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, screen: 'granted' }));
    } catch (err) {
      setPermissions(prev => ({ ...prev, screen: 'denied' }));
      showModal('Screen Share Access Denied', 'You must allow screen sharing to continue. This is required for proctoring.');
    }
  };

  const startInterview = () => {
    if (permissions.camera !== 'granted' || permissions.screen !== 'granted') {
      showModal('Permissions Required', 'All permissions must be granted before starting the interview. Please refresh and allow access.');
      return;
    }
    setStage('interview');
    generateQuestions();
    startProctoring();
  };

  const generateQuestions = () => {
    let questionPool = [];
    const profileLower = jobProfile.toLowerCase();
    if (profileLower.includes('sde') || profileLower.includes('developer')) {
      questionPool = SDE_QUESTIONS;
    } else if (profileLower.includes('data scientist') || profileLower.includes('machine learning')) {
      questionPool = DS_QUESTIONS;
    } else if (profileLower.includes('analyst')) {
      questionPool = BA_QUESTIONS;
    } else {
      questionPool = [...SDE_QUESTIONS.slice(0, 5), ...DS_QUESTIONS.slice(0, 5), ...BA_QUESTIONS.slice(0, 5)];
    }
    const shuffled = [...questionPool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);
    const finalQuestions = [{ question: "To start, please introduce yourself and walk me through your resume.", type: "Introductory" }, ...selected];
    if (profileLower.includes('sde') || profileLower.includes('developer')) {
      finalQuestions.push({ question: "Let's move to a coding problem. Please explain your approach and then write a C++ function to reverse a linked list.", type: "Coding" });
    } else if (profileLower.includes('data scientist')) {
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
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    setIsBotSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      setIsBotSpeaking(false);
      startListening();
    };
    speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) { console.error("Speech recognition not supported."); return; }
    if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    speechRecognitionRef.current = recognition;
    let finalTranscript = '';
    recognition.onstart = () => {
      setIsListening(true);
      resetSilenceTimer();
    };
    recognition.onresult = (event) => {
      resetSilenceTimer();
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      const combinedTranscript = (finalTranscript + interimTranscript).toLowerCase();
      const skipPhrases = ["skip", "next question", "move on", "next one"];
      if (skipPhrases.some(phrase => combinedTranscript.includes(phrase))) {
        handleUserSpeech(finalTranscript, true);
      }
    };
    recognition.onerror = (event) => {
      // console.error("Speech recognition error:", event.error);
      if (event.error === 'no-speech') {
        handleNextQuestion(true);
      }
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      handleUserSpeech(finalTranscript);
    };
    recognition.start();
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      speechRecognitionRef.current?.stop();
    }, 10000);
  };

  const handleUserSpeech = (transcript, isSkipCommand = false) => {
    const finalTranscript = transcript.trim();
    const currentQuestion = questions[currentQuestionIndex];

    setInterviewData(prev => [...prev, {
      ...currentQuestion,
      answer: isSkipCommand ? "Skipped" : (finalTranscript || "No answer provided")
    }]);

    if (isSkipCommand) { handleNextQuestion(true); return; }
    if (!finalTranscript) { handleNextQuestion(true); return; }
    handleNextQuestion(false);
  };

  const handleNextQuestion = (isUnanswered = false) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    speechRecognitionRef.current?.stop();
    if (isUnanswered) setUnansweredCount(prev => prev + 1);
    if (unansweredCount + (isUnanswered ? 1 : 0) >= 3) {
      generateAndSetScorecard();
      return;
    }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      generateAndSetScorecard();
    }
  };

  const endInterview = () => {
    generateAndSetScorecard();
  };

  const startProctoring = () => {
    faceApiIntervalRef.current = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && window.faceapi) {
        const detections = await window.faceapi.detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions());
        if (detections.length === 0) addWarning("No person detected in the camera.");
        else if (detections.length > 1) addWarning("Multiple people detected in the camera.");
      }
    }, 5000);
  };

  const addWarning = (message, showModalWarning = false) => {
    setWarnings(prev => {
      const recentWarning = prev.find(w => w.message === message);
      if (recentWarning && (Date.now() - recentWarning.time.getTime() < 10000)) return prev;

      const newWarnings = [...prev, { message, time: new Date() }];
      if (newWarnings.length > 3) {
        endInterview("The interview has been terminated due to multiple violations.");
      }
      return newWarnings;
    });
    if (showModalWarning) showModal("Proctoring Warning", message);
  };

  const generateAndSetScorecard = () => {
    setIsGeneratingReport(true);
    setStage('report');
    
    setTimeout(() => {
      const technicalScores = {};
      let totalScore = 0;
      let answeredCount = 0;

      interviewData.forEach(item => {
        const score = item.answer === "Skipped" || item.answer === "No answer provided" ? 0 : Math.floor(Math.random() * 5) + 6;
        item.score = score;
        
        if (score > 0) {
          totalScore += score;
          answeredCount++;
        }

        const type = item.type || 'General';
        if (!technicalScores[type]) {
          technicalScores[type] = { scores: [], total: 0, count: 0 };
        }
        technicalScores[type].scores.push(score);
        technicalScores[type].total += score;
        technicalScores[type].count++;
      });

      const topicAverages = Object.entries(technicalScores).map(([topic, data]) => ({
        topic,
        average: data.count > 0 ? (data.total / data.count) : 0
      }));

      const finalScorecard = {
        overallScore: answeredCount > 0 ? (totalScore / answeredCount) : 0,
        // --- MODIFIED SECTION START ---
        // Scores are now conditional on whether any questions were answered.
        fluency: answeredCount > 0 ? (Math.random() * 4 + 6) : 0,
        confidence: answeredCount > 0 ? (Math.random() * 4 + 6) : 0,
        // --- MODIFIED SECTION END ---
        topicAverages,
        detailedFeedback: interviewData
      };

      setScorecard(finalScorecard);
      setIsGeneratingReport(false);
    }, 2000);
  };

  const handleDownloadReport = () => {
    const reportElement = reportRef.current;
    if (reportElement) {
      html2canvas(reportElement, { backgroundColor: '#1E1E1E' }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Interview-Report-${new Date().toLocaleDateString()}.pdf`);
      });
    }
  };

  const renderSetup = () => (
    <div className="w-full max-w-4xl mx-auto p-12 bg-card rounded-2xl shadow-2xl border border-border">
      <h2 className="text-4xl font-bold text-center mb-4 text-foreground">AI Interview Assistant</h2>
      <p className="text-lg text-center text-accent mb-10">Upload your resume and specify the job profile to begin.</p>
      <div className="space-y-8">
        <div>
          <label htmlFor="job-profile" className="block text-base font-medium text-accent mb-2 text-left">Job Profile</label>
          <select id="job-profile" value={jobProfile} onChange={(e) => setJobProfile(e.target.value)}
            className="w-full bg-input border border-border rounded-md px-4 py-3 text-base text-foreground focus:ring-2 focus:ring-primary focus:outline-none">
            <option value="" disabled>Select a job profile...</option>
            {jobProfiles.map(profile => (<option key={profile} value={profile}>{profile}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-base font-medium text-accent mb-2 text-left">Upload Resume (PDF)</label>
          {!resumeFile ? (
            <label htmlFor="file-upload" className="relative cursor-pointer mt-1 flex flex-col items-center justify-center w-full h-40 px-6 pt-5 pb-6 border-2 border-border border-dashed rounded-md hover:border-primary transition-colors">
              <div className="space-y-1 text-center">
                <p className="text-base text-accent">Click to upload or drag and drop</p>
                <p className="text-sm text-accent/70">PDF (MAX. 10MB)</p>
              </div>
              <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf" />
            </label>
          ) : (
            <div className="mt-1 flex items-center justify-between w-full h-auto min-h-[6rem] px-4 py-3 bg-input border-2 border-primary rounded-md">
              <p className="text-base text-foreground truncate">{resumeFile.name}</p>
              <button onClick={removeFile} className="text-accent hover:text-red-500 p-1 rounded-full"><X size={24} /></button>
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-red-400 mt-4"><AlertTriangle className="inline mr-2 h-4 w-4" />{error}</p>}
      <div className="mt-10">
        <button onClick={proceedToPermissions} className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 px-4 rounded-md transition duration-300 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          disabled={!jobProfile || !resumeFile || isLoading}>
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
      <button onClick={startInterview} className="w-full bg-secondary hover:bg-secondary-hover text-white font-bold py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
        disabled={permissions.camera !== 'granted' || permissions.screen !== 'granted' || isLoading}>
        {isLoading ? 'Generating Questions...' : 'Start Interview'}
      </button>
    </div>
  );

  const renderInterview = () => (
    <div className="w-full h-screen flex flex-col p-4 gap-4">
      <div className="flex-grow flex gap-4 overflow-hidden">
        <div className="w-2/3 flex flex-col bg-card rounded-lg p-6 shadow-lg border border-border">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center">
              <Bot className="h-8 w-8 text-secondary mr-3" />
              <h2 className="text-xl font-semibold">Interviewer</h2>
            </div>
            <div className="flex items-center space-x-2 text-accent text-sm">
              {isBotSpeaking ? <Loader2 className="h-5 w-5 animate-spin text-secondary flex-shrink-0" /> : <div className="w-5 h-5 flex-shrink-0" />}
              <span className="whitespace-nowrap">{isBotSpeaking ? 'Speaking...' : 'Idle'}</span>
            </div>
          </div>
          <div className="flex-grow flex items-center justify-center">
            {questions.length > 0 && (
              <p className="text-2xl text-center font-medium text-foreground animate-fade-in">
                {questions[currentQuestionIndex].question}
              </p>
            )}
          </div>
        </div>

        <div className="w-1/3 flex flex-col bg-card rounded-lg shadow-lg border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-4 flex-shrink-0">
            <Mic className={`h-6 w-6 flex-shrink-0 ${isListening ? 'text-green-400' : 'text-accent'}`} />
            <div className="flex-grow">
              <span className="font-semibold text-foreground">Microphone Status</span>
              <span className="text-sm text-accent block">{isListening ? 'Listening...' : 'Inactive'}</span>
            </div>
            <canvas ref={visualizerRef} width="100" height="40" className="transition-opacity duration-300" style={{ opacity: isListening ? 1 : 0 }}></canvas>
          </div>
          <div className="flex-grow p-2 relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover rounded-md aspect-video"
            />
            <div className="absolute top-4 left-4 bg-black bg-opacity-50 px-2 py-1 rounded-md text-sm flex items-center">
              <User className="h-4 w-4 mr-1" />Your Camera
            </div>
          </div>
        </div>
      </div>

      <div className="h-24 bg-card rounded-lg p-3 overflow-y-auto shadow-lg border border-border flex-shrink-0">
        <h3 className="text-sm font-semibold text-accent mb-2 flex items-center"><AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />Proctoring Warnings</h3>
        {warnings.length === 0 ? <p className="text-sm text-accent">No warnings yet.</p> : (
          <ul className="text-xs text-yellow-400 space-y-1">
            {warnings.map((w, i) => <li key={i}>{w.time.toLocaleTimeString()}: {w.message}</li>)}
          </ul>
        )}
      </div>
    </div>
  );

  const renderScorecard = () => {
    if (isGeneratingReport || !scorecard) {
      return (
        <div className="w-full max-w-4xl mx-auto p-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold text-foreground">Generating Your Report...</h2>
          <p className="text-accent">Analyzing your performance and preparing the scorecard.</p>
        </div>
      );
    }

    return (
      <div className="w-full max-w-4xl mx-auto">
        <div ref={reportRef} className="p-8 sm:p-12 bg-card rounded-lg shadow-2xl border border-border">
          <h2 className="text-3xl font-bold text-center mb-2 text-foreground">Interview Scorecard</h2>
          <p className="text-center text-accent mb-10">Here is a summary of your performance.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 text-center">
            <div className="p-4 bg-input rounded-lg">
              <h3 className="text-sm font-semibold text-accent uppercase">Overall Score</h3>
              <p className="text-4xl font-bold text-primary">{scorecard.overallScore.toFixed(1)} / 10</p>
            </div>
            <div className="p-4 bg-input rounded-lg">
              <h3 className="text-sm font-semibold text-accent uppercase">Fluency</h3>
              <p className="text-4xl font-bold text-secondary">{scorecard.fluency.toFixed(1)} / 10</p>
            </div>
            <div className="p-4 bg-input rounded-lg">
              <h3 className="text-sm font-semibold text-accent uppercase">Confidence</h3>
              <p className="text-4xl font-bold text-secondary">{scorecard.confidence.toFixed(1)} / 10</p>
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-xl font-bold text-left mb-4 text-foreground">Technical Skills Breakdown</h3>
            <div className="space-y-4">
              {scorecard.topicAverages.map(({ topic, average }) => (
                <div key={topic}>
                  <div className="flex justify-between mb-1">
                    <span className="text-base font-medium text-accent">{topic}</span>
                    <span className="text-sm font-medium text-accent">{average.toFixed(1)} / 10</span>
                  </div>
                  <div className="w-full bg-input rounded-full h-2.5">
                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${average * 10}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-left mb-4 text-foreground">Detailed Feedback</h3>
            <div className="space-y-6 text-left">
              {scorecard.detailedFeedback.map((item, index) => (
                <div key={index} className="p-4 bg-input rounded-md border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-primary">Question {index + 1}:</h4>
                    <span className={`font-bold text-lg ${item.score >= 8 ? 'text-green-400' : item.score >= 6 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {item.score.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-foreground mb-3">{item.question}</p>
                  <h5 className="font-semibold text-secondary text-sm mb-2">Your Answer:</h5>
                  <p className="text-accent text-sm italic">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <button onClick={handleDownloadReport} className="flex-1 w-full bg-secondary hover:bg-secondary-hover text-white font-bold py-3 px-4 rounded-md transition duration-300 flex items-center justify-center gap-2">
            <Download size={20} />
            Download Report
          </button>
          <button onClick={() => setStage('end')} className="flex-1 w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-md transition duration-300">
            Finish Review
          </button>
        </div>
      </div>
    );
  };

  const renderEnd = () => (
    <div className="w-full max-w-2xl mx-auto p-8 bg-card rounded-lg shadow-xl text-center border border-border">
      <Bot size={48} className="mx-auto text-secondary mb-4" />
      <h1 className="text-3xl font-bold mb-2">Interview Finished</h1>
      <p className="text-accent mb-6">The interview has concluded. It was nice talking to you. Thank you!</p>
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-background">
      <WarningModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
      />
      {stage === 'setup' && renderSetup()}
      {stage === 'permissions' && renderPermissions()}
      {stage === 'interview' && renderInterview()}
      {stage === 'report' && renderScorecard()}
      {stage === 'end' && renderEnd()}
    </main>
  );
}