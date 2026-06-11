import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const API_BASE_URL = 'http://localhost:4000/api';

// Shared types
interface Task {
  id: string;
  subjectId: string;
  chapterId: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'done';
  deleted: boolean;
  rev: number;
  updatedBy: string;
}

interface FocusSession {
  id: string;
  studentId: string;
  durationMinutes: number;
  status: 'started' | 'success' | 'failed';
  reason: 'give_up' | 'app_switch' | null;
  startTime: number;
  endTime: number;
  dateStr: string;
}

interface NotificationLog {
  id: string;
  sessionId: string;
  message: string;
  timestamp: number;
}

interface Stats {
  coins: number;
  streak: number;
  todayMinutes: number;
}

const INITIAL_LOCAL_TASKS: Task[] = [
  { id: 't1', subjectId: 'math', chapterId: 'algebra', title: 'Quadratic Equations', status: 'not_started', deleted: false, rev: 0, updatedBy: 'server' },
  { id: 't2', subjectId: 'math', chapterId: 'algebra', title: 'Linear Inequalities', status: 'not_started', deleted: false, rev: 0, updatedBy: 'server' },
  { id: 't3', subjectId: 'math', chapterId: 'geometry', title: 'Pythagoras Theorem', status: 'not_started', deleted: false, rev: 0, updatedBy: 'server' },
  { id: 't4', subjectId: 'science', chapterId: 'physics', title: "Newton's Laws", status: 'not_started', deleted: false, rev: 0, updatedBy: 'server' },
  { id: 't5', subjectId: 'science', chapterId: 'physics', title: 'Friction and Gravity', status: 'not_started', deleted: false, rev: 0, updatedBy: 'server' },
  { id: 't6', subjectId: 'science', chapterId: 'chemistry', title: 'Periodic Table Basics', status: 'not_started', deleted: false, rev: 0, updatedBy: 'server' }
];

const generateId = () => Math.random().toString(36).substring(2, 11);

const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Global App Entry Component
export default function App() {
  const [serverNotifications, setServerNotifications] = useState<NotificationLog[]>([]);
  const [globalRefreshTrigger, setGlobalRefreshTrigger] = useState(0);
  const [resetting, setResetting] = useState(false);

  const fetchServerNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setServerNotifications(data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchServerNotifications();
    const interval = setInterval(fetchServerNotifications, 3000);

    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@300;400;500;600;700;800&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    return () => clearInterval(interval);
  }, []);

  const handleResetServer = async () => {
    setResetting(true);
    try {
      await fetch(`${API_BASE_URL}/reset`, { method: 'POST' });
      // Reset localStorages
      localStorage.removeItem('alcovia_device_device_a');
      localStorage.removeItem('alcovia_device_device_b');
      setGlobalRefreshTrigger(prev => prev + 1);
      fetchServerNotifications();
    } catch (err) {
      alert('Failed to reset database');
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Alcovia Sync Emulator</Text>
          <Text style={styles.headerSubtitle}>Offline-First Sync, Conflict Resolution & n8n Idempotence Demo</Text>
        </View>
        <View style={styles.headerControls}>
          <TouchableOpacity style={styles.resetButton} onPress={handleResetServer} disabled={resetting}>
            {resetting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.resetButtonText}>Reset All Databases</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainGrid}>
        <View style={styles.deviceColumn}>
          <DeviceSimulator 
            clientId="device_a" 
            displayName="Device A (Phone)" 
            globalRefreshTrigger={globalRefreshTrigger}
            onSyncComplete={fetchServerNotifications}
          />
        </View>
        
        <View style={styles.deviceColumn}>
          <DeviceSimulator 
            clientId="device_b" 
            displayName="Device B (Laptop)" 
            globalRefreshTrigger={globalRefreshTrigger}
            onSyncComplete={fetchServerNotifications}
          />
        </View>

        <View style={styles.notificationSidebar}>
          <Text style={styles.sidebarTitle}>n8n Webhook / Notification Log</Text>
          <Text style={styles.sidebarSubtitle}>Real-time delivery from mock notification sink</Text>
          <ScrollView style={styles.notificationList}>
            {serverNotifications.length === 0 ? (
              <Text style={styles.noNotifications}>No notifications sent yet. Succeed in a focus session to trigger.</Text>
            ) : (
              serverNotifications.map((notif) => (
                <View key={notif.id} style={styles.notificationCard}>
                  <Text style={styles.notificationMsg}>{notif.message}</Text>
                  <Text style={styles.notificationTime}>
                    Session ID: {notif.sessionId} • {new Date(notif.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// Device Simulator Component
function DeviceSimulator({
  clientId,
  displayName,
  globalRefreshTrigger,
  onSyncComplete
}: {
  clientId: string;
  displayName: string;
  globalRefreshTrigger: number;
  onSyncComplete: () => void;
}) {
  const [online, setOnline] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [stats, setStats] = useState<Stats>({ coins: 0, streak: 0, todayMinutes: 0 });
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Focus Timer States
  const [focusDuration, setFocusDuration] = useState('25');
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  const [bgGraceTimer, setBgGraceTimer] = useState(0);

  // Task Creation State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState('math');
  const [newTaskChapter, setNewTaskChapter] = useState('algebra');

  const timerRef = useRef<any>(null);
  const graceTimerRef = useRef<any>(null);

  // Load state from local storage on mount/reset
  useEffect(() => {
    const saved = localStorage.getItem(`alcovia_device_${clientId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTasks(parsed.tasks || INITIAL_LOCAL_TASKS);
        setSessions(parsed.sessions || []);
        setStats(parsed.stats || { coins: 0, streak: 0, todayMinutes: 0 });
        setHasPendingChanges(parsed.hasPendingChanges || false);
      } catch (err) {
        resetLocalState();
      }
    } else {
      resetLocalState();
    }
    // Clean up timers
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    };
  }, [globalRefreshTrigger]);

  const resetLocalState = () => {
    setTasks(INITIAL_LOCAL_TASKS);
    setSessions([]);
    setStats({ coins: 0, streak: 0, todayMinutes: 0 });
    setHasPendingChanges(false);
    setActiveSession(null);
    setIsBackgrounded(false);
    saveLocalState(INITIAL_LOCAL_TASKS, [], { coins: 0, streak: 0, todayMinutes: 0 }, false);
  };

  const saveLocalState = (
    updatedTasks: Task[],
    updatedSessions: FocusSession[],
    updatedStats: Stats,
    pending: boolean
  ) => {
    localStorage.setItem(
      `alcovia_device_${clientId}`,
      JSON.stringify({
        tasks: updatedTasks,
        sessions: updatedSessions,
        stats: updatedStats,
        hasPendingChanges: pending
      })
    );
  };

  // Sync Logic
  const performSync = async () => {
    if (!online || syncing) return;
    setSyncing(true);
    try {
      const payload = {
        tasks,
        focusSessions: sessions,
        clientLocalDateStr: getTodayDateStr(),
        clientId
      };

      const response = await fetch(`${API_BASE_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Sync endpoint failed');

      const data = await response.json();

      // Overwrite local tasks and sessions with server-merged truth
      setTasks(data.tasks);
      setSessions(data.focusSessions);
      setStats(data.stats);
      setHasPendingChanges(false);
      saveLocalState(data.tasks, data.focusSessions, data.stats, false);
      onSyncComplete();
    } catch (err) {
      console.error(`[Sync Error ${clientId}]`, err);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync when going online or when there are pending changes
  useEffect(() => {
    if (online && hasPendingChanges) {
      performSync();
    }
  }, [online, hasPendingChanges]);

  // Periodic sync checks
  useEffect(() => {
    const interval = setInterval(() => {
      if (online) {
        performSync();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [online, tasks, sessions]);

  // Task Manipulation
  const handleTaskStatusChange = (taskId: string, newStatus: 'not_started' | 'in_progress' | 'done') => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus,
          rev: t.rev + 1,
          updatedBy: clientId
        };
      }
      return t;
    });
    setTasks(updated);
    setHasPendingChanges(true);
    saveLocalState(updated, sessions, stats, true);
  };

  const handleTaskDelete = (taskId: string) => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          deleted: true,
          rev: t.rev + 1,
          updatedBy: clientId
        };
      }
      return t;
    });
    setTasks(updated);
    setHasPendingChanges(true);
    saveLocalState(updated, sessions, stats, true);
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: 'task_' + generateId(),
      subjectId: newTaskSubject,
      chapterId: newTaskChapter,
      title: newTaskTitle.trim(),
      status: 'not_started',
      deleted: false,
      rev: 1,
      updatedBy: clientId
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    setNewTaskTitle('');
    setHasPendingChanges(true);
    saveLocalState(updated, sessions, stats, true);
  };

  // Focus Session Controls
  const startFocusSession = () => {
    const mins = parseInt(focusDuration) || 25;
    const newSession: FocusSession = {
      id: 'sess_' + generateId(),
      studentId: 'student_1',
      durationMinutes: mins,
      status: 'started',
      reason: null,
      startTime: Date.now(),
      endTime: 0,
      dateStr: getTodayDateStr()
    };
    setActiveSession(newSession);
    setTimeLeft(mins * 60);
    setIsBackgrounded(false);
  };

  // Simulated timer effect
  useEffect(() => {
    if (activeSession && activeSession.status === 'started' && !isBackgrounded) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            completeSession(true, null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSession, isBackgrounded]);

  // Grace Period Simulation
  useEffect(() => {
    if (isBackgrounded && activeSession && activeSession.status === 'started') {
      setBgGraceTimer(5);
      graceTimerRef.current = setInterval(() => {
        setBgGraceTimer(prev => {
          if (prev <= 1) {
            clearInterval(graceTimerRef.current!);
            completeSession(false, 'app_switch');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (graceTimerRef.current) {
        clearInterval(graceTimerRef.current);
      }
    }
    return () => {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    };
  }, [isBackgrounded]);

  const completeSession = (success: boolean, reason: 'give_up' | 'app_switch' | null) => {
    if (!activeSession) return;
    const updatedSession: FocusSession = {
      ...activeSession,
      status: success ? 'success' : 'failed',
      reason,
      endTime: Date.now()
    };

    const updatedSessions = [...sessions, updatedSession];
    
    // Update local stats instantly
    let updatedStats = { ...stats };
    if (success) {
      updatedStats.coins += 50;
      updatedStats.todayMinutes += updatedSession.durationMinutes;
      
      // Calculate local streak
      const uniqueDates = Array.from(new Set(updatedSessions.filter(s => s.status === 'success').map(s => s.dateStr))).sort();
      let streak = 0;
      const todayStr = getTodayDateStr();
      const hasToday = uniqueDates.includes(todayStr);
      const hasYesterday = uniqueDates.includes(getYesterdayStr(todayStr));
      if (hasToday || hasYesterday) {
        let checkStr = hasToday ? todayStr : getYesterdayStr(todayStr);
        while (uniqueDates.includes(checkStr)) {
          streak++;
          checkStr = getYesterdayStr(checkStr);
        }
      }
      updatedStats.streak = streak;
    }

    setSessions(updatedSessions);
    setStats(updatedStats);
    setActiveSession(null);
    setIsBackgrounded(false);
    setHasPendingChanges(true);
    saveLocalState(tasks, updatedSessions, updatedStats, true);
  };

  const getYesterdayStr = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Group syllabus tasks by Subject and Chapter for rendering
  const activeTasks = tasks.filter(t => !t.deleted);
  const subjects = ['math', 'science'];
  const chapters: Record<string, string[]> = {
    math: ['algebra', 'geometry'],
    science: ['physics', 'chemistry']
  };

  // Progress helper
  const getChapterProgress = (sub: string, ch: string) => {
    const chTasks = activeTasks.filter(t => t.subjectId === sub && t.chapterId === ch);
    if (chTasks.length === 0) return 0;
    const completed = chTasks.filter(t => t.status === 'done').length;
    return Math.round((completed / chTasks.length) * 100);
  };

  const getSubjectProgress = (sub: string) => {
    const subTasks = activeTasks.filter(t => t.subjectId === sub);
    if (subTasks.length === 0) return 0;
    const completed = subTasks.filter(t => t.status === 'done').length;
    return Math.round((completed / subTasks.length) * 100);
  };

  return (
    <View style={styles.deviceCard}>
      {/* Device Header */}
      <View style={styles.deviceHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name={clientId === 'device_a' ? 'smartphone' : 'monitor'} size={18} color="#ffffff" />
          <Text style={styles.deviceTitle}>{displayName}</Text>
        </View>
        <TouchableOpacity
          style={[styles.statusToggle, online ? styles.onlineBtn : styles.offlineBtn]}
          onPress={() => setOnline(!online)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name={online ? "wifi" : "wifi-off"} size={13} color={online ? "#ffffff" : "#6b7280"} />
            <Text style={[styles.statusToggleText, { color: online ? '#ffffff' : '#6b7280' }]}>{online ? 'Online' : 'Offline'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Sync Banner */}
      <View style={[styles.syncBanner, hasPendingChanges ? styles.syncPending : styles.syncSuccess]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather 
            name={syncing ? "refresh-cw" : hasPendingChanges ? "alert-circle" : "check-circle"} 
            size={12} 
            color={hasPendingChanges ? "#4169e1" : "#ffffff"} 
          />
          <Text style={styles.syncBannerText}>
            {syncing ? 'Syncing...' : hasPendingChanges ? 'Unsynced Changes Pending' : 'Synced'}
          </Text>
        </View>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Feather name="zap" size={14} color="#4169e1" />
            <Text style={styles.statVal}>{stats.streak}d</Text>
          </View>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
        <View style={styles.statBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Feather name="award" size={14} color="#4169e1" />
            <Text style={styles.statVal}>{stats.coins}</Text>
          </View>
          <Text style={styles.statLabel}>Coins</Text>
        </View>
        <View style={styles.statBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Feather name="clock" size={14} color="#4169e1" />
            <Text style={styles.statVal}>{stats.todayMinutes}m</Text>
          </View>
          <Text style={styles.statLabel}>Today</Text>
        </View>
      </View>

      <ScrollView style={styles.deviceContent} nestedScrollEnabled={true}>
        {/* Focus Timer Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="target" size={15} color="#4169e1" />
            <Text style={styles.sectionHeaderText}>Focus Session</Text>
          </View>
          {!activeSession ? (
            <View style={styles.sessionForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Duration (min):</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={focusDuration}
                  onChangeText={setFocusDuration}
                />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={startFocusSession}>
                <Text style={styles.primaryButtonText}>Start Focus Session</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </Text>
              {isBackgrounded ? (
                <View style={styles.graceAlert}>
                  <Text style={styles.graceAlertText}>App Backgrounded! Fail in {bgGraceTimer}s</Text>
                  <TouchableOpacity style={styles.returnBtn} onPress={() => setIsBackgrounded(false)}>
                    <Text style={styles.returnBtnText}>Return to App</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.timerControls}>
                  <TouchableOpacity style={styles.warnButton} onPress={() => setIsBackgrounded(true)}>
                    <Text style={styles.warnButtonText}>Background App</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.successButton} onPress={() => completeSession(true, null)}>
                    <Text style={styles.successButtonText}>Fast Forward (Succeed)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerButton} onPress={() => completeSession(false, 'give_up')}>
                    <Text style={styles.dangerButtonText}>Give Up</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Syllabus Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="book-open" size={15} color="#4169e1" />
            <Text style={styles.sectionHeaderText}>Syllabus Progress</Text>
          </View>
          
          {subjects.map(sub => (
            <View key={sub} style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <Text style={styles.subjectTitle}>{sub.toUpperCase()}</Text>
                <Text style={styles.progressText}>{getSubjectProgress(sub)}% Complete</Text>
              </View>

              {chapters[sub].map(ch => (
                <View key={ch} style={styles.chapterSection}>
                  <View style={styles.chapterHeader}>
                    <Text style={styles.chapterTitle}>{ch.charAt(0).toUpperCase() + ch.slice(1)}</Text>
                    <Text style={styles.chapterProgressText}>{getChapterProgress(sub, ch)}%</Text>
                  </View>

                  {/* Task list for chapter */}
                  {activeTasks
                    .filter(t => t.subjectId === sub && t.chapterId === ch)
                    .map(task => (
                      <View key={task.id} style={styles.taskItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.taskTitle}>{task.title}</Text>
                          <Text style={styles.taskMeta}>Rev: {task.rev} • By: {task.updatedBy}</Text>
                        </View>
                        <View style={styles.taskActions}>
                          <select
                            value={task.status}
                            onChange={(e) => handleTaskStatusChange(task.id, (e.target as HTMLSelectElement).value as any)}
                            style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827', borderRadius: 6, padding: 6, fontSize: 12 }}
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleTaskDelete(task.id)}>
                            <Feather name="trash-2" size={14} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                </View>
              ))}
            </View>
          ))}

          {/* Add custom task */}
          <View style={styles.addTaskCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Feather name="plus-circle" size={14} color="#4169e1" />
              <Text style={styles.addTaskTitle}>Add Custom Task</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Task name"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />
            <View style={styles.addTaskDropdowns}>
              <select
                value={newTaskSubject}
                onChange={(e) => {
                  const val = (e.target as HTMLSelectElement).value;
                  setNewTaskSubject(val);
                  setNewTaskChapter(chapters[val][0]);
                }}
                style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827', borderRadius: 6, padding: 6, fontSize: 12 }}
              >
                <option value="math">Math</option>
                <option value="science">Science</option>
              </select>
              <select
                value={newTaskChapter}
                onChange={(e) => setNewTaskChapter((e.target as HTMLSelectElement).value)}
                style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827', borderRadius: 6, padding: 6, fontSize: 12 }}
              >
                {chapters[newTaskSubject].map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleCreateTask}>
              <Text style={styles.secondaryButtonText}>Create Task Offline</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Local History log */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="list" size={15} color="#4169e1" />
            <Text style={styles.sectionHeaderText}>Local Focus History ({sessions.length})</Text>
          </View>
          {sessions.length === 0 ? (
            <Text style={styles.noHistory}>No focus sessions logged on this device yet.</Text>
          ) : (
            sessions.map((sess, idx) => (
              <View key={sess.id || idx} style={styles.historyItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Feather 
                    name={sess.status === 'success' ? "check-circle" : "x-circle"} 
                    size={13} 
                    color={sess.status === 'success' ? "#4169e1" : "#ef4444"} 
                  />
                  <Text style={styles.historyStatus}>
                    {sess.status === 'success' ? 'SUCCESS' : 'FAILED'} ({sess.durationMinutes}m)
                  </Text>
                </View>
                <Text style={styles.historyMeta}>
                  {sess.reason ? `Reason: ${sess.reason}` : 'Completed successfully'} • ID: {sess.id.substring(5)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 32,
    fontFamily: "'Bricolage Grotesque', system-ui, -apple-system, sans-serif",
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: '#ffffff',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 6,
  },
  headerControls: {
    flexDirection: 'row',
    gap: 12,
  },
  resetButton: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 13,
  },
  mainGrid: {
    flexDirection: 'row',
    gap: 32,
    flex: 1,
  },
  deviceColumn: {
    flex: 1,
    minWidth: 340,
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    marginBottom: 20,
  },
  deviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
  },
  statusToggle: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
  },
  onlineBtn: {
    backgroundColor: '#4169e1',
    borderColor: '#4169e1',
  },
  offlineBtn: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  statusToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  syncBanner: {
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginBottom: 20,
  },
  syncSuccess: {
    backgroundColor: '#f9fafb',
  },
  syncPending: {
    backgroundColor: '#f9fafb',
    borderLeftWidth: 3,
    borderColor: '#4169e1',
  },
  syncBannerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    marginBottom: 24,
    paddingVertical: 12,
  },
  statBox: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4169e1',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
  },
  deviceContent: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  sessionForm: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#4169e1',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
    shadowColor: '#4169e1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 1,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  timerText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'monospace',
    marginBottom: 16,
    letterSpacing: 2,
  },
  timerControls: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  successButton: {
    backgroundColor: '#4169e1',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    shadowColor: '#4169e1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 1,
  },
  successButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  dangerButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
  },
  warnButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#4169e1',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  warnButtonText: {
    color: '#4169e1',
    fontWeight: '600',
    fontSize: 13,
  },
  graceAlert: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    width: '100%',
    alignItems: 'center',
  },
  graceAlertText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  returnBtn: {
    backgroundColor: '#4169e1',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  returnBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  subjectCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4169e1',
    letterSpacing: 0.5,
  },
  progressText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  chapterSection: {
    marginBottom: 12,
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chapterTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  chapterProgressText: {
    fontSize: 11,
    color: '#6b7280',
  },
  taskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  taskTitle: {
    fontSize: 13,
    color: '#111827',
  },
  taskMeta: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    padding: 4,
  },
  addTaskCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  addTaskTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  addTaskDropdowns: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#4169e1',
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4169e1',
    fontSize: 12,
    fontWeight: '600',
  },
  noHistory: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 16,
  },
  historyItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  historyMeta: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  notificationSidebar: {
    width: 320,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sidebarSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 20,
  },
  notificationList: {
    flex: 1,
  },
  noNotifications: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 48,
  },
  notificationCard: {
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderColor: '#4169e1',
  },
  notificationMsg: {
    fontSize: 12,
    color: '#111827',
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 6,
  },
});
