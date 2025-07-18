// Global variables
let startTime = null;
let timerInterval = null;
let lastStoppedTime = null;
let totalReadingSeconds = 0;
let totalBreakSeconds = 0;
let readingChart = null;
let breakChart = null;
let activityPatternChart = null;
let currentActivityView = 'weekly';

// Audio context for better sound support
let audioContext = null;

// Initialize audio context
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Enhanced sound function with fallback
function playSound() {
  initAudio();
  
  // Create a simple beep sound
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
  
  // Fallback to HTML5 audio
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
    audio.play().catch(() => {});
  } catch (e) {}
}

// Enhanced start reading function with proper state management
function handleStartReading() {
  playSound();
  const today = new Date().toISOString().split('T')[0];
  
  // Check if we're resuming from a break
  if (localStorage.getItem('is_reading') === 'false' && lastStoppedTime) {
    const breakTime = Math.floor((Date.now() - lastStoppedTime) / 1000);
    totalBreakSeconds += breakTime;
    updateBreakTimeDisplay();
    document.getElementById('breakPopup').style.display = 'flex';
    return;
  }
  
  // Check if this is the first start of the day
  if (!localStorage.getItem('first_start_today') || localStorage.getItem('first_start_today') !== today) {
    localStorage.setItem('first_start_today', today);
    startReading();
  } else if (lastStoppedTime && localStorage.getItem('is_reading') === 'false') {
    const breakTime = Math.floor((Date.now() - lastStoppedTime) / 1000);
    totalBreakSeconds += breakTime;
    updateBreakTimeDisplay();
    document.getElementById('breakPopup').style.display = 'flex';
  } else {
    startReading();
  }
}

function startReading() {
  if (timerInterval) return;
  
  startTime = Date.now();
  localStorage.setItem('reading_start_time', startTime.toString());
  localStorage.setItem('is_reading', 'true');
  
  document.getElementById("readingStatus").textContent = "Reading in progress...";
  document.getElementById("readingStatus").style.animation = "none";
  setTimeout(() => {
    document.getElementById("readingStatus").style.animation = "fadeIn 0.5s ease";
  }, 10);
  
  // Update button states
  document.getElementById("startBtn").style.opacity = "0.6";
  document.getElementById("stopBtn").style.opacity = "1";
  
  timerInterval = setInterval(updateReadingTime, 1000);
}

function stopReading() {
  playSound();
  if (!startTime || !timerInterval) return;
  
  const endTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = null;
  
  const sessionSeconds = Math.floor((endTime - startTime) / 1000);
  totalReadingSeconds += sessionSeconds;
  
  // Update localStorage with proper state
  localStorage.removeItem('reading_start_time');
  localStorage.setItem('is_reading', 'false');
  localStorage.setItem('last_stop_time', endTime.toString());
  localStorage.setItem('total_reading_seconds', totalReadingSeconds.toString());
  localStorage.setItem('total_break_seconds', totalBreakSeconds.toString());
  
  // Save session data for charts and history
  saveSessionData(startTime, endTime, sessionSeconds);
  saveTodaysSession(startTime, endTime, sessionSeconds);
  
  updateReadingTimeDisplay();
  updateCharts();

  const s = new Date(startTime);
  const e = new Date(endTime);
  const duration = formatDuration(sessionSeconds);
  addSessionToHistory(`${formatTime(s)} — ${formatTime(e)} (${duration})`);

  lastStoppedTime = endTime;
  startTime = null;
  
  // Update button states
  document.getElementById("startBtn").style.opacity = "1";
  document.getElementById("stopBtn").style.opacity = "0.6";
  
  document.getElementById("timerDisplay").textContent = "00:00:00";
  document.getElementById("readingStatus").textContent = "Session completed";
}

// Save today's session to localStorage
function saveTodaysSession(startTime, endTime, duration) {
  const today = new Date().toISOString().split('T')[0];
  let todaySessions = JSON.parse(localStorage.getItem('todays_sessions') || '{}');
  
  if (!todaySessions[today]) {
    todaySessions[today] = [];
  }
  
  todaySessions[today].push({
    start: startTime,
    end: endTime,
    duration: duration,
    type: 'reading'
  });
  
  localStorage.setItem('todays_sessions', JSON.stringify(todaySessions));
}

// Save session data for analytics
function saveSessionData(startTime, endTime, duration) {
  const today = new Date().toISOString().split('T')[0];
  let sessions = JSON.parse(localStorage.getItem('reading_sessions') || '{}');
  
  if (!sessions[today]) {
    sessions[today] = [];
  }
  
  sessions[today].push({
    start: startTime,
    end: endTime,
    duration: duration,
    hour: new Date(startTime).getHours()
  });
  
  localStorage.setItem('reading_sessions', JSON.stringify(sessions));
}

// Save break activity data
function saveBreakActivityData(activities, duration) {
  const today = new Date().toISOString().split('T')[0];
  let breakData = JSON.parse(localStorage.getItem('break_activities') || '{}');
  
  if (!breakData[today]) {
    breakData[today] = {};
  }
  
  activities.forEach(activity => {
    if (!breakData[today][activity]) {
      breakData[today][activity] = 0;
    }
    breakData[today][activity] += duration;
  });
  
  localStorage.setItem('break_activities', JSON.stringify(breakData));
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function updateReadingTime() {
  if (!startTime) return;
  
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  
  document.getElementById("timerDisplay").textContent = 
    `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateReadingTimeDisplay() {
  document.getElementById("totalReadingTime").textContent = formatDuration(totalReadingSeconds);
}

function updateBreakTimeDisplay() {
  document.getElementById("totalBreakTime").textContent = formatDuration(totalBreakSeconds);
}

function addSessionToHistory(text) {
  const list = document.getElementById("sessionList");
  const item = document.createElement("li");
  item.innerHTML = `<i class="fas fa-clock"></i> ${text}`;
  item.style.animation = "fadeIn 0.5s ease";
  list.appendChild(item);
}

function closePopup() {
  document.getElementById("breakPopup").style.display = "none";
  // Clear all checkboxes
  document.querySelectorAll('#breakForm input[type="checkbox"]').forEach(cb => cb.checked = false);
}

function saveBreakActivities() {
  const checkboxes = document.querySelectorAll('#breakForm input[type="checkbox"]:checked');
  const activities = Array.from(checkboxes).map(cb => cb.value);
  const now = new Date();
  const breakDuration = Math.floor((now - lastStoppedTime) / 1000);
  
  // Save break activity data for charts
  if (activities.length > 0) {
    saveBreakActivityData(activities, breakDuration);
  }
  
  // Save to today's sessions
  const today = new Date().toISOString().split('T')[0];
  let todaySessions = JSON.parse(localStorage.getItem('todays_sessions') || '{}');
  if (!todaySessions[today]) {
    todaySessions[today] = [];
  }
  todaySessions[today].push({
    start: lastStoppedTime,
    end: now.getTime(),
    duration: breakDuration,
    type: 'break',
    activities: activities
  });
  localStorage.setItem('todays_sessions', JSON.stringify(todaySessions));
  
  const breakText = `Break (${formatTime(new Date(lastStoppedTime))} — ${formatTime(now)}): ${activities.join(', ') || 'No activities selected'}`;
  addSessionToHistory(breakText);
  
  closePopup();
  updateCharts();
  lastStoppedTime = null;
  startReading();
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.getElementById('themeIcon').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
  
  // Update charts with new theme
  setTimeout(updateCharts, 100);
}

// Enhanced Chart functions with professional animations
function initCharts() {
  const ctx1 = document.getElementById('readingChart').getContext('2d');
  const ctx2 = document.getElementById('breakChart').getContext('2d');
  const ctx3 = document.getElementById('activityPatternChart').getContext('2d');
  
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#fff' : '#000';
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  
  // Professional Reading Progress Chart
  readingChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: '⏳ Reading Time',
        data: [],
        backgroundColor: function(context) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(0, 198, 255, 0.2)');
          gradient.addColorStop(0.5, 'rgba(0, 198, 255, 0.6)');
          gradient.addColorStop(1, 'rgba(0, 198, 255, 1)');
          return gradient;
        },
        borderColor: '#00c6ff',
        borderWidth: 2,
        borderRadius: {
          topLeft: 8,
          topRight: 8,
          bottomLeft: 0,
          bottomRight: 0
        },
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: textColor,
            font: { size: 14, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: '#00c6ff',
          borderWidth: 2,
          cornerRadius: 12,
          displayColors: false,
          titleFont: { size: 14, weight: '600' },
          bodyFont: { size: 13 },
          padding: 12,
          callbacks: {
            title: function(context) {
              return `📅 ${context[0].label}`;
            },
            label: function(context) {
              const hours = Math.floor(context.parsed.y / 60);
              const minutes = context.parsed.y % 60;
              return `⏱️ ${hours}h ${minutes}m of focused reading`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { 
            color: textColor,
            font: { size: 12, weight: '500' },
            callback: function(value) {
              const hours = Math.floor(value / 60);
              const minutes = value % 60;
              return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            }
          },
          grid: { 
            color: gridColor,
            drawBorder: false,
            lineWidth: 1
          },
          title: {
            display: true,
            text: '📊 Reading Duration',
            color: textColor,
            font: { size: 13, weight: '600' }
          }
        },
        x: {
          ticks: { 
            color: textColor,
            font: { size: 12, weight: '500' }
          },
          grid: { 
            display: false,
            drawBorder: false
          }
        }
      },
      animation: {
        duration: 2500,
        easing: 'easeInOutQuart',
        delay: (context) => context.dataIndex * 150,
        onProgress: function(animation) {
          const chart = animation.chart;
          const ctx = chart.ctx;
          ctx.save();
          
          // Add shimmer effect during animation
          if (animation.currentStep < animation.numSteps) {
            const gradient = ctx.createLinearGradient(0, 0, chart.width, 0);
            gradient.addColorStop(0, 'rgba(255,255,255,0)');
            gradient.addColorStop(0.5, 'rgba(255,255,255,0.3)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, chart.width, chart.height);
          }
          
          ctx.restore();
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });
  
  // Professional Break Activities Chart
  breakChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
          '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
          '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
          '#F1948A', '#85C1E9', '#F8C471', '#82E0AA'
        ],
        borderWidth: 4,
        borderColor: isDark ? '#121212' : '#fff',
        hoverBorderWidth: 6,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { size: 12, weight: '500' },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle',
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                const dataset = data.datasets[0];
                const total = dataset.data.reduce((a, b) => a + b, 0);
                
                return data.labels.map((label, i) => {
                  const value = dataset.data[i];
                  const percentage = ((value / total) * 100).toFixed(1);
                  return {
                    text: `➤ ${label} (${percentage}%)`,
                    fillStyle: dataset.backgroundColor[i],
                    strokeStyle: dataset.borderColor,
                    lineWidth: dataset.borderWidth,
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: '#00c6ff',
          borderWidth: 2,
          cornerRadius: 12,
          titleFont: { size: 14, weight: '600' },
          bodyFont: { size: 13 },
          padding: 12,
          callbacks: {
            title: function(context) {
              return `🎯 ${context[0].label}`;
            },
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              const minutes = Math.round(context.parsed);
              const hours = Math.floor(minutes / 60);
              const mins = minutes % 60;
              const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
              return `➤ Time spent: ${timeStr} (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        duration: 3000,
        easing: 'easeInOutQuart',
        animateRotate: true,
        animateScale: true,
        onProgress: function(animation) {
          const chart = animation.chart;
          const ctx = chart.ctx;
          
          // Add rotation effect during animation
          if (animation.currentStep < animation.numSteps) {
            const progress = animation.currentStep / animation.numSteps;
            ctx.save();
            ctx.translate(chart.width / 2, chart.height / 2);
            ctx.rotate(progress * Math.PI * 2);
            ctx.translate(-chart.width / 2, -chart.height / 2);
            ctx.restore();
          }
        }
      },
      cutout: '65%',
      radius: '85%'
    }
  });
  
  // Professional Activity Pattern Chart
  activityPatternChart = new Chart(ctx3, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: '📈 Activity Score',
        data: [],
        borderColor: '#00c6ff',
        backgroundColor: function(context) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(0, 198, 255, 0.1)');
          gradient.addColorStop(0.5, 'rgba(0, 198, 255, 0.3)');
          gradient.addColorStop(1, 'rgba(0, 198, 255, 0.6)');
          return gradient;
        },
        borderWidth: 4,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00c6ff',
        pointBorderColor: '#fff',
        pointBorderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 12,
        pointHoverBackgroundColor: '#00e6ff',
        pointHoverBorderWidth: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: textColor,
            font: { size: 14, weight: '600' },
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: '#00c6ff',
          borderWidth: 2,
          cornerRadius: 12,
          titleFont: { size: 14, weight: '600' },
          bodyFont: { size: 13 },
          padding: 12,
          callbacks: {
            title: function(context) {
              return `📊 ${context[0].label}`;
            },
            label: function(context) {
              return `⚡ Activity Score: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { 
            color: textColor,
            font: { size: 12, weight: '500' }
          },
          grid: { 
            color: gridColor,
            drawBorder: false,
            lineWidth: 1
          },
          title: {
            display: true,
            text: '⚡ Activity Level',
            color: textColor,
            font: { size: 13, weight: '600' }
          }
        },
        x: {
          ticks: { 
            color: textColor,
            font: { size: 12, weight: '500' }
          },
          grid: { 
            display: false,
            drawBorder: false
          }
        }
      },
      animation: {
        duration: 2500,
        easing: 'easeInOutQuart',
        delay: (context) => context.dataIndex * 100
      }
    }
  });
  
  updateCharts();
}

function toggleReadingChart(period) {
  // Update button states
  document.querySelectorAll('.chart-container:first-child .toggle-option').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  updateReadingChart(period);
}

function toggleBreakChart(period) {
  // Update button states
  document.querySelectorAll('.chart-container:nth-child(2) .toggle-option').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  updateBreakChart(period);
}

function toggleActivityPattern(period) {
  // Update button states
  document.querySelectorAll('.chart-container:nth-child(3) .toggle-option').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  currentActivityView = period;
  
  if (period === 'heatmap') {
    document.getElementById('activityPatternChart').style.display = 'none';
    document.getElementById('activityHeatmap').style.display = 'grid';
    updateActivityHeatmap();
  } else {
    document.getElementById('activityPatternChart').style.display = 'block';
    document.getElementById('activityHeatmap').style.display = 'none';
    updateActivityPatternChart(period);
  }
}

function updateReadingChart(period = 'weekly') {
  if (!readingChart) return;
  
  const sessions = JSON.parse(localStorage.getItem('reading_sessions') || '{}');
  const data = [];
  const labels = [];
  
  if (period === 'weekly') {
    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en', { weekday: 'short' });
      
      labels.push(dayName);
      
      if (sessions[dateStr]) {
        const totalMinutes = sessions[dateStr].reduce((sum, session) => sum + session.duration, 0) / 60;
        data.push(Math.round(totalMinutes));
      } else {
        data.push(0);
      }
    }
  } else {
    // Get last 30 days grouped by week
    const weeks = {};
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = 0;
      }
      
      if (sessions[dateStr]) {
        const totalMinutes = sessions[dateStr].reduce((sum, session) => sum + session.duration, 0) / 60;
        weeks[weekKey] += totalMinutes;
      }
    }
    
    Object.keys(weeks).forEach(weekStart => {
      const date = new Date(weekStart);
      labels.push(`Week ${date.getMonth() + 1}/${date.getDate()}`);
      data.push(Math.round(weeks[weekStart]));
    });
  }
  
  readingChart.data.labels = labels;
  readingChart.data.datasets[0].data = data;
  readingChart.update('active');
}

function updateBreakChart(period = 'weekly') {
  if (!breakChart) return;
  
  const breakData = JSON.parse(localStorage.getItem('break_activities') || '{}');
  const activityTotals = {};
  
  const daysToCheck = period === 'weekly' ? 7 : 30;
  
  for (let i = daysToCheck - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (breakData[dateStr]) {
      Object.keys(breakData[dateStr]).forEach(activity => {
        if (!activityTotals[activity]) {
          activityTotals[activity] = 0;
        }
        activityTotals[activity] += breakData[dateStr][activity];
      });
    }
  }
  
  const labels = Object.keys(activityTotals);
  const data = Object.values(activityTotals).map(seconds => Math.round(seconds / 60)); // Convert to minutes
  
  breakChart.data.labels = labels;
  breakChart.data.datasets[0].data = data;
  breakChart.update('active');
}

function updateActivityPatternChart(period = 'weekly') {
  if (!activityPatternChart) return;
  
  const sessions = JSON.parse(localStorage.getItem('reading_sessions') || '{}');
  const data = [];
  const labels = [];
  
  if (period === 'weekly') {
    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en', { weekday: 'short' });
      
      labels.push(dayName);
      
      if (sessions[dateStr]) {
        // Calculate activity score based on sessions and duration
        const sessionCount = sessions[dateStr].length;
        const totalMinutes = sessions[dateStr].reduce((sum, session) => sum + session.duration, 0) / 60;
        const activityScore = Math.round((sessionCount * 10) + (totalMinutes / 10));
        data.push(activityScore);
      } else {
        data.push(0);
      }
    }
  } else {
    // Get last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      labels.push(`Week ${weekStart.getMonth() + 1}/${weekStart.getDate()}`);
      
      let weeklyScore = 0;
      for (let d = 0; d < 7; d++) {
        const checkDate = new Date(weekStart);
        checkDate.setDate(weekStart.getDate() + d);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        if (sessions[dateStr]) {
          const sessionCount = sessions[dateStr].length;
          const totalMinutes = sessions[dateStr].reduce((sum, session) => sum + session.duration, 0) / 60;
          weeklyScore += (sessionCount * 10) + (totalMinutes / 10);
        }
      }
      
      data.push(Math.round(weeklyScore));
    }
  }
  
  activityPatternChart.data.labels = labels;
  activityPatternChart.data.datasets[0].data = data;
  activityPatternChart.update('active');
}

function updateActivityHeatmap() {
  const sessions = JSON.parse(localStorage.getItem('reading_sessions') || '{}');
  const heatmapContainer = document.getElementById('activityHeatmap');
  heatmapContainer.innerHTML = '';
  
  // Create hour blocks (0-23)
  const hourData = new Array(24).fill(0);
  
  // Calculate activity for each hour
  Object.keys(sessions).forEach(date => {
    sessions[date].forEach(session => {
      const hour = new Date(session.start).getHours();
      hourData[hour] += session.duration / 60; // Convert to minutes
    });
  });
  
  // Find max value for normalization
  const maxActivity = Math.max(...hourData);
  
  // Create hour blocks
  for (let hour = 0; hour < 24; hour++) {
    const block = document.createElement('div');
    block.className = 'hour-block';
    
    const activity = hourData[hour];
    const intensity = maxActivity > 0 ? activity / maxActivity : 0;
    
    if (intensity > 0.7) {
      block.classList.add('active-high');
    } else if (intensity > 0.3) {
      block.classList.add('active-medium');
    } else if (intensity > 0) {
      block.classList.add('active-low');
    }
    
    block.title = `${hour}:00 - ${Math.round(activity)} minutes`;
    block.innerHTML = `<span style="font-size: 10px; font-weight: bold;">${hour}</span>`;
    
    heatmapContainer.appendChild(block);
  }
  
  // Add legend if not exists
  if (!document.querySelector('.heatmap-legend')) {
    const legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.innerHTML = `
      <div class="legend-item">
        <div class="legend-color" style="background: var(--card-background);"></div>
        <span>No activity</span>
      </div>
      <div class="legend-item">
        <div class="legend-color active-low"></div>
        <span>Low</span>
      </div>
      <div class="legend-item">
        <div class="legend-color active-medium"></div>
        <span>Medium</span>
      </div>
      <div class="legend-item">
        <div class="legend-color active-high"></div>
        <span>High</span>
      </div>
    `;
    heatmapContainer.parentNode.appendChild(legend);
  }
}

function updateCharts() {
  if (readingChart && breakChart && activityPatternChart) {
    updateReadingChart('weekly');
    updateBreakChart('weekly');
    if (currentActivityView === 'heatmap') {
      updateActivityHeatmap();
    } else {
      updateActivityPatternChart('weekly');
    }
  }
}

// Load today's sessions from localStorage
function loadTodaysSessions() {
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = JSON.parse(localStorage.getItem('todays_sessions') || '{}');
  
  if (todaySessions[today]) {
    todaySessions[today].forEach(session => {
      if (session.type === 'reading') {
        const s = new Date(session.start);
        const e = new Date(session.end);
        const duration = formatDuration(session.duration);
        addSessionToHistory(`${formatTime(s)} — ${formatTime(e)} (${duration})`);
      } else if (session.type === 'break') {
        const s = new Date(session.start);
        const e = new Date(session.end);
        const activities = session.activities ? session.activities.join(', ') : 'No activities selected';
        addSessionToHistory(`Break (${formatTime(s)} — ${formatTime(e)}): ${activities}`);
      }
    });
  }
}

// Daily reset function
function checkAndResetDailyData() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const lastDate = localStorage.getItem('last_reset_date');

  if (lastDate !== today && now.getHours() === 0 && now.getMinutes() === 0) {
    // Reset daily counters but keep historical data
    totalReadingSeconds = 0;
    totalBreakSeconds = 0;
    document.getElementById("totalReadingTime").textContent = "0h 0m 0s";
    document.getElementById("totalBreakTime").textContent = "0h 0m 0s";
    document.getElementById("sessionList").innerHTML = "";
    
    localStorage.setItem('total_reading_seconds', "0");
    localStorage.setItem('total_break_seconds', "0");
    localStorage.setItem('first_start_today', today);
    localStorage.setItem('last_reset_date', today);
    localStorage.removeItem('is_reading');
    localStorage.removeItem('reading_start_time');
    
    // Clear today's sessions for the new day
    let todaySessions = JSON.parse(localStorage.getItem('todays_sessions') || '{}');
    delete todaySessions[lastDate];
    localStorage.setItem('todays_sessions', JSON.stringify(todaySessions));
  }
}

// Service Worker registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Initialize app
window.addEventListener('load', () => {
  // Theme initialization
  const theme = localStorage.getItem('theme');
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  document.getElementById('themeIcon').className = isDark ? 'fas fa-moon' : 'fas fa-sun';

  // Resume reading if was in progress
  const isReading = localStorage.getItem('is_reading');
  const savedStartTime = localStorage.getItem('reading_start_time');
  
  if (isReading === 'true' && savedStartTime) {
    startTime = parseInt(savedStartTime);
    timerInterval = setInterval(updateReadingTime, 1000);
    document.getElementById("readingStatus").textContent = "Reading resumed...";
    document.getElementById("startBtn").style.opacity = "0.6";
    document.getElementById("stopBtn").style.opacity = "1";
  } else {
    document.getElementById("startBtn").style.opacity = "1";
    document.getElementById("stopBtn").style.opacity = "0.6";
  }

  // Load saved data
  totalReadingSeconds = parseInt(localStorage.getItem('total_reading_seconds') || "0");
  totalBreakSeconds = parseInt(localStorage.getItem('total_break_seconds') || "0");
  lastStoppedTime = parseInt(localStorage.getItem('last_stop_time')) || null;
  
  updateReadingTimeDisplay();
  updateBreakTimeDisplay();
  
  // Load today's sessions
  loadTodaysSessions();
  
  // Initialize charts
  setTimeout(initCharts, 100);
  
  // Check for daily reset
  checkAndResetDailyData();
});

// Check for daily reset every minute
setInterval(checkAndResetDailyData, 60 * 1000);

// Handle visibility change to keep timer running in background
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && startTime) {
    // Update timer when page becomes visible again
    updateReadingTime();
  }
});

// Handle page unload to save state
window.addEventListener('beforeunload', () => {
  if (startTime && timerInterval) {
    localStorage.setItem('reading_start_time', startTime.toString());
    localStorage.setItem('is_reading', 'true');
  } else {
    localStorage.setItem('is_reading', 'false');
  }
});
