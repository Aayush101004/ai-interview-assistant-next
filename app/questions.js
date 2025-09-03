// File: app/questions.js

export const SDE_QUESTIONS = [
    // OS
    { question: "What is a deadlock and how can it be prevented?", type: "OS" },
    { question: "Explain the difference between a process and a thread.", type: "OS" },
    { question: "What is virtual memory?", type: "OS" },
    { question: "Describe the concept of paging in operating systems.", type: "OS" },
    { question: "What are system calls?", type: "OS" },
    { question: "Explain the purpose of a semaphore.", type: "OS" },
    { question: "What is scheduling? Describe two types of schedulers.", type: "OS" },
    { question: "What is memory fragmentation?", type: "OS" },
    { question: "Explain the concept of multithreading.", type: "OS" },
    { question: "What is the role of the kernel in an operating system?", type: "OS" },

    // DBMS
    { question: "What is normalization in databases? Why is it important?", type: "DBMS" },
    { question: "Explain the ACID properties in the context of database transactions.", type: "DBMS" },
    { question: "What is an index in a database? How does it improve performance?", type: "DBMS" },
    { question: "Describe the difference between SQL and NoSQL databases.", type: "DBMS" },
    { question: "What is a foreign key?", type: "DBMS" },
    { question: "Explain the concept of database joins.", type: "DBMS" },
    { question: "What is a transaction in a database?", type: "DBMS" },
    { question: "Describe the three levels of data abstraction.", type: "DBMS" },
    { question: "What is the difference between DELETE, TRUNCATE, and DROP commands?", type: "DBMS" },
    { question: "Explain what a primary key is.", type: "DBMS" },

    // CN
    { question: "What are the seven layers of the OSI model? Briefly describe each.", type: "CN" },
    { question: "Explain the difference between TCP and UDP.", type: "CN" },
    { question: "What is a DNS? How does it work?", type: "CN" },
    { question: "Describe the three-way handshake in TCP.", type: "CN" },
    { question: "What is an IP address?", type: "CN" },
    { question: "Explain the function of a router.", type: "CN" },
    { question: "What is HTTP, and how is it different from HTTPS?", type: "CN" },
    { question: "What is a subnet mask?", type: "CN" },
    { question: "Explain the concept of a firewall.", type: "CN" },
    { question: "What is latency in a network?", type: "CN" },

    // General/Behavioral
    { question: "Tell me about a challenging technical problem you solved.", type: "Behavioral" },
    { question: "How do you stay updated with the latest technologies?", type: "Behavioral" },
    { question: "Describe a time you had a conflict with a team member and how you resolved it.", type: "Behavioral" },
    { question: "What are your career goals for the next five years?", type: "Behavioral" },
    { question: "Why do you want to work for our company?", type: "Behavioral" },
];

export const DS_QUESTIONS = [
    // Statistics & Probability
    { question: "Explain the difference between supervised and unsupervised learning.", type: "ML Concepts" },
    { question: "What is the bias-variance tradeoff?", type: "ML Concepts" },
    { question: "Describe p-value in the context of hypothesis testing.", type: "Statistics" },
    { question: "What is cross-validation and why is it useful?", type: "ML Concepts" },
    { question: "Explain the Central Limit Theorem.", type: "Statistics" },
    { question: "What are Type I and Type II errors?", type: "Statistics" },
    { question: "Describe the difference between correlation and causation.", type: "Statistics" },
    { question: "What is A/B testing?", type: "Statistics" },
    { question: "Explain Bayes' Theorem.", type: "Probability" },
    { question: "What is a confusion matrix?", type: "ML Concepts" },

    // Machine Learning Models
    { question: "How does a Random Forest model work?", type: "ML Models" },
    { question: "Explain the concept of gradient descent.", type: "ML Concepts" },
    { question: "What is overfitting and how can you prevent it?", type: "ML Concepts" },
    { question: "Describe how a Support Vector Machine (SVM) works.", type: "ML Models" },
    { question: "What are the assumptions of linear regression?", type: "ML Models" },
    { question: "Explain the K-Means clustering algorithm.", type: "ML Models" },
    { question: "What is regularization? Explain L1 and L2 regularization.", type: "ML Concepts" },
    { question: "Describe a decision tree.", type: "ML Models" },
    { question: "What are neural networks?", type: "ML Models" },
    { question: "Explain the concept of feature engineering.", type: "ML Concepts" },

    // Python/Pandas
    { question: "What is the difference between a list and a tuple in Python?", type: "Python" },
    { question: "How do you handle missing values in a Pandas DataFrame?", type: "Pandas" },
    { question: "Explain what a decorator is in Python.", type: "Python" },
    { question: "What is the purpose of the 'groupby' function in Pandas?", type: "Pandas" },
    { question: "Describe the Global Interpreter Lock (GIL) in Python.", type: "Python" },
    { question: "How do you merge two DataFrames in Pandas?", type: "Pandas" },
    { question: "What are list comprehensions in Python?", type: "Python" },
    { question: "Explain the difference between .loc and .iloc in Pandas.", type: "Pandas" },
    { question: "What are Python generators?", type: "Python" },
    { question: "How would you apply a function to every element in a Pandas Series?", type: "Pandas" },

    // General/Behavioral
    { question: "Tell me about a data science project you are proud of.", type: "Behavioral" },
    { question: "How would you explain a complex machine learning model to a non-technical stakeholder?", type: "Behavioral" },
    { question: "Describe a time when your analysis led to a significant business impact.", type: "Behavioral" },
    { question: "What are your favorite data visualization libraries and why?", type: "Behavioral" },
    { question: "How do you ensure the quality and accuracy of your data?", type: "Behavioral" },
];