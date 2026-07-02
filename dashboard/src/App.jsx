import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Settings, 
  MessageSquare, 
  Trophy, 
  Server, 
  Cpu, 
  Database, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Save, 
  User, 
  BookOpen, 
  ChevronRight,
  TrendingUp,
  Terminal,
  Send,
  Wifi,
  WifiOff,
  Bell
} from 'lucide-react';
import { io } from 'socket.io-client';
import './App.css';

const API_BASE = 'http://localhost:3001';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [botStatus, setBotStatus] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [guildConfig, setGuildConfig] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Socket & Live State
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [liveLogs, setLiveLogs] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [dispatchMessage, setDispatchMessage] = useState('');
  const [dispatchStatus, setDispatchStatus] = useState(''); // 'sending', 'success', 'error'
  const [dispatchError, setDispatchError] = useState('');
  const [notifications, setNotifications] = useState([]);
  
  // Settings Form State
  const [welcomeChannelId, setWelcomeChannelId] = useState('');
  const [logChannelId, setLogChannelId] = useState('');
  const [ticketCategoryId, setTicketCategoryId] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // Fetch status and guilds on mount
  useEffect(() => {
    fetchStatus();
    fetchGuilds();
    fetchChatHistory();
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketInstance = io(API_BASE);
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to socket server');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from socket server');
    });

    socketInstance.on('bot_status', (status) => {
      setBotStatus(status);
    });

    socketInstance.on('channels_list', (data) => {
      if (data.guildId === selectedGuildId && !data.error) {
        setChannels(data.channels);
        if (data.channels.length > 0) {
          setSelectedChannelId(data.channels[0].id);
        } else {
          setSelectedChannelId('');
        }
      }
    });

    socketInstance.on('bot_event', (event) => {
      setLiveLogs((prev) => [event, ...prev].slice(0, 100)); // Keep last 100 events
    });

    socketInstance.on('recent_events', (events) => {
      // Sort with the newest first
      setLiveLogs(events.slice().reverse());
    });

    socketInstance.on('level_up', (data) => {
      const id = Date.now();
      const newNotification = {
        id,
        title: '🎉 Level Up!',
        text: `${data.userTag} reached Level ${data.level}!`,
        type: 'success'
      };
      setNotifications((prev) => [newNotification, ...prev]);
      
      // Auto-dismiss after 5s
      setTimeout(() => {
        setNotifications((prev) => prev.filter(n => n.id !== id));
      }, 5000);

      // Refresh leaderboard if active guild context matches
      if (selectedGuildId === data.guildId) {
        fetchLeaderboard(data.guildId);
      }
    });

    socketInstance.on('message_success', (data) => {
      setDispatchStatus('success');
      setDispatchMessage('');
      setTimeout(() => setDispatchStatus(''), 3000);
    });

    socketInstance.on('message_error', (data) => {
      setDispatchStatus('error');
      setDispatchError(data.error || 'Failed to send message');
      setTimeout(() => setDispatchStatus(''), 5000);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [selectedGuildId]);

  // Request channels when selected guild or socket changes
  useEffect(() => {
    if (socket && selectedGuildId) {
      socket.emit('get_channels', selectedGuildId);
    }
  }, [socket, selectedGuildId]);

  // Fetch settings when guild changes
  useEffect(() => {
    if (selectedGuildId) {
      fetchGuildConfig(selectedGuildId);
      fetchLeaderboard(selectedGuildId);
    }
  }, [selectedGuildId]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setBotStatus(data);
      }
    } catch (e) {
      console.error('Error fetching bot status:', e);
    }
  };

  const fetchGuilds = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/guilds`);
      if (res.ok) {
        const data = await res.json();
        setGuilds(data);
        if (data.length > 0 && !selectedGuildId) {
          setSelectedGuildId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching guilds:', e);
    }
  };

  const fetchGuildConfig = async (guildId) => {
    try {
      const res = await fetch(`${API_BASE}/api/config/${guildId}`);
      if (res.ok) {
        const data = await res.json();
        setGuildConfig(data);
        setWelcomeChannelId(data.config.welcomeChannelId || '');
        setLogChannelId(data.config.logChannelId || '');
        setTicketCategoryId(data.config.ticketCategoryId || '');
      }
    } catch (e) {
      console.error('Error fetching guild settings:', e);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data);
      }
    } catch (e) {
      console.error('Error fetching chat history:', e);
    }
  };

  const fetchLeaderboard = async (guildId) => {
    try {
      const res = await fetch(`${API_BASE}/api/levels/${guildId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (e) {
      console.error('Error fetching levels:', e);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/config/${selectedGuildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcomeChannelId, logChannelId, ticketCategoryId })
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error('Error saving configurations:', e);
      setSaveStatus('error');
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-section">
          <Bot size={32} className="bot-icon-logo" />
          <h2>TejasBot</h2>
        </div>
        
        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Server size={20} />
            <span>Manage Bot</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <MessageSquare size={20} />
            <span>Chat History</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Manage Settings</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            <Trophy size={20} />
            <span>Leaderboard</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            <Terminal size={20} />
            <span>Live Monitor</span>
          </button>
        </nav>

        {/* User / Bot Profile at the bottom of the sidebar */}
        <div className="sidebar-profile">
          {botStatus?.user ? (
            <>
              <div className="avatar-wrapper">
                <img src={botStatus.user.avatar} alt="Bot Avatar" className="profile-avatar" />
                <span className={`socket-indicator ${isConnected ? 'connected' : 'disconnected'}`} title={isConnected ? 'WebSocket Connected' : 'WebSocket Offline'}></span>
              </div>
              <div className="profile-info">
                <span className="profile-tag">{botStatus.user.tag}</span>
                <span className="profile-status">
                  {isConnected ? 'Real-time Active' : 'Polling Fallback'}
                </span>
              </div>
            </>
          ) : (
            <div className="profile-loading">Connecting...</div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="content-header">
          <h1>
            {activeTab === 'dashboard' && 'Dashboard Overview'}
            {activeTab === 'history' && 'Conversational Analytics'}
            {activeTab === 'settings' && 'Bot Configurations'}
            {activeTab === 'leaderboard' && 'Leveling Leaderboard'}
            {activeTab === 'live' && 'Real-time Console & Dispatcher'}
          </h1>
          <div className="guild-selector-container">
            <span className="select-label">Server Context:</span>
            <select 
              value={selectedGuildId} 
              onChange={(e) => setSelectedGuildId(e.target.value)}
              className="guild-select"
            >
              {guilds.map(guild => (
                <option key={guild.id} value={guild.id}>{guild.name}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Dashboard Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="tab-pane">
            {/* Stats Metrics Cards */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon-wrapper blue">
                  <Bot size={24} />
                </div>
                <div className="metric-data">
                  <h3>Bot Status</h3>
                  <p className={`status-badge ${botStatus?.status || 'offline'}`}>
                    {botStatus?.status ? botStatus.status.toUpperCase() : 'CONNECTING...'}
                  </p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-wrapper green">
                  <Server size={24} />
                </div>
                <div className="metric-data">
                  <h3>Connected Servers</h3>
                  <p className="metric-value">{botStatus?.guilds || 0}</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-wrapper purple">
                  <Cpu size={24} />
                </div>
                <div className="metric-data">
                  <h3>API Latency</h3>
                  <p className="metric-value">{botStatus?.ping || 0} ms</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-wrapper yellow">
                  <Clock size={24} />
                </div>
                <div className="metric-data">
                  <h3>Uptime</h3>
                  <p className="metric-value-text">{formatUptime(botStatus?.uptime)}</p>
                </div>
              </div>
            </div>

            {/* Quick Status / Environment Checklist */}
            <div className="dashboard-sections">
              <div className="content-card glass-panel">
                <h2>System Health Diagnostics</h2>
                <p className="section-subtitle">Core server connectivity and variables checklist.</p>
                
                <ul className="checklist">
                  <li className="checklist-item">
                    {botStatus?.status === 'online' ? (
                      <CheckCircle className="check-success" size={20} />
                    ) : (
                      <XCircle className="check-error" size={20} />
                    )}
                    <span>Discord API Gateway Connection</span>
                  </li>
                  <li className="checklist-item">
                    <CheckCircle className="check-success" size={20} />
                    <span>MongoDB Database Service Connection</span>
                  </li>
                  <li className="checklist-item">
                    <CheckCircle className="check-success" size={20} />
                    <span>Google Gemini API Credentials Loaded</span>
                  </li>
                  <li className="checklist-item">
                    <CheckCircle className="check-success" size={20} />
                    <span>Intents (Guilds, Members, Messages) Configured</span>
                  </li>
                </ul>
              </div>

              <div className="content-card glass-panel">
                <h2>Quick Info</h2>
                <div className="quick-info-row">
                  <span>Guild Context Name:</span>
                  <strong>{guilds.find(g => g.id === selectedGuildId)?.name || 'N/A'}</strong>
                </div>
                <div className="quick-info-row">
                  <span>Guild Context Members:</span>
                  <strong>{guilds.find(g => g.id === selectedGuildId)?.memberCount || 0} members</strong>
                </div>
                <div className="quick-info-row">
                  <span>API Port:</span>
                  <strong>3001</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat History Tab Content */}
        {activeTab === 'history' && (
          <div className="tab-pane chat-history-pane">
            <div className="history-layout">
              {/* Left Column: Users List */}
              <div className="users-list-panel glass-panel">
                <h3>Active Dialogues ({chatHistory.length})</h3>
                <div className="users-list-items">
                  {chatHistory.map((item, idx) => (
                    <button
                      key={idx}
                      className={`user-item-btn ${selectedHistoryIndex === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedHistoryIndex(idx)}
                    >
                      <div className="user-avatar-placeholder">
                        <User size={16} />
                      </div>
                      <div className="user-btn-details">
                        <span className="user-btn-tag">{item.userTag}</span>
                        <span className="user-btn-type">
                          {item.type === 'interview' ? `🎙️ Mock Interview (${item.topic})` : '💬 AI Conversation'}
                        </span>
                      </div>
                      <ChevronRight size={16} className="chevron-icon" />
                    </button>
                  ))}
                  {chatHistory.length === 0 && (
                    <p className="empty-message">No dialogue records found in the database.</p>
                  )}
                </div>
              </div>

              {/* Right Column: Dialogue Thread */}
              <div className="chat-thread-panel glass-panel">
                {selectedHistoryIndex !== null ? (
                  <>
                    <div className="thread-header">
                      <h3>Dialogue Log: {chatHistory[selectedHistoryIndex].userTag}</h3>
                      <span className="thread-type-badge">
                        {chatHistory[selectedHistoryIndex].type.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="thread-bubbles">
                      {chatHistory[selectedHistoryIndex].history.map((msg, msgIdx) => {
                        const isUser = msg.role === 'user';
                        // Extract text cleanly
                        const text = msg.parts[0]?.text || '';
                        
                        return (
                          <div key={msgIdx} className={`chat-bubble-container ${isUser ? 'user' : 'model'}`}>
                            <div className="chat-bubble-info">
                              <span className="bubble-role">
                                {isUser ? 'User' : 'TejasBot'}
                              </span>
                            </div>
                            <div className="chat-bubble">
                              <p className="bubble-text">{text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="empty-thread-placeholder">
                    <MessageSquare size={48} className="fade-icon" />
                    <h3>Select a dialogue to view the logs</h3>
                    <p>Select one of the conversation threads on the left to read user logs.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Manage Settings Tab Content */}
        {activeTab === 'settings' && (
          <div className="tab-pane">
            <div className="settings-container glass-panel">
              <h2>Configure Server Integration Settings</h2>
              <p className="section-subtitle">Define the channels and categories used by the welcome, auditing logs, and ticket modules.</p>
              
              {guildConfig ? (
                <form onSubmit={saveSettings} className="settings-form">
                  <div className="form-group">
                    <label>👋 Welcome Messages Channel</label>
                    <p className="field-desc">Sets the channel where new member join greetings are announced.</p>
                    <select
                      value={welcomeChannelId}
                      onChange={(e) => setWelcomeChannelId(e.target.value)}
                      className="form-control"
                    >
                      <option value="">-- Disable Welcome Messages --</option>
                      {guildConfig.channels.map(ch => (
                        <option key={ch.id} value={ch.id}>#{ch.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>🛡️ Audit Actions Logging Channel</label>
                    <p className="field-desc">Defines the channel where member join/leave logs, edited and deleted messages are logged.</p>
                    <select
                      value={logChannelId}
                      onChange={(e) => setLogChannelId(e.target.value)}
                      className="form-control"
                    >
                      <option value="">-- Disable Logging --</option>
                      {guildConfig.channels.map(ch => (
                        <option key={ch.id} value={ch.id}>#{ch.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>🎫 Tickets Category Channel</label>
                    <p className="field-desc">Sets the Discord Category under which new ticket channels will be generated.</p>
                    <select
                      value={ticketCategoryId}
                      onChange={(e) => setTicketCategoryId(e.target.value)}
                      className="form-control"
                    >
                      <option value="">-- Disable / Create Category at Root --</option>
                      {guildConfig.categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-submit-container">
                    <button type="submit" className="btn-save" disabled={saveStatus === 'saving'}>
                      <Save size={18} />
                      <span>{saveStatus === 'saving' ? 'Saving Configurations...' : 'Save Settings'}</span>
                    </button>

                    {saveStatus === 'success' && (
                      <span className="save-message success">Config saved successfully!</span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="save-message error">Failed to save configuration.</span>
                    )}
                  </div>
                </form>
              ) : (
                <div className="form-loading">Retrieving configurations...</div>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard Tab Content */}
        {activeTab === 'leaderboard' && (
          <div className="tab-pane">
            <div className="leaderboard-panel glass-panel">
              <div className="leaderboard-header">
                <h2>Ranks Leaderboard</h2>
                <div className="leaderboard-meta">
                  <TrendingUp size={16} />
                  <span>Ranked by cumulative server XP</span>
                </div>
              </div>

              <div className="leaderboard-table-wrapper">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Member</th>
                      <th>Level</th>
                      <th>XP Progression</th>
                      <th>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player, idx) => {
                      const xpNeeded = 100 * (player.level + 1);
                      const progressPercent = Math.min((player.xp / xpNeeded) * 100, 100);
                      
                      let rankMedal = `#${idx + 1}`;
                      if (idx === 0) rankMedal = '🥇';
                      else if (idx === 1) rankMedal = '🥈';
                      else if (idx === 2) rankMedal = '🥉';

                      return (
                        <tr key={player.userId}>
                          <td className="rank-col">{rankMedal}</td>
                          <td className="user-col">
                            <span className="username">{player.userTag}</span>
                            <span className="user-id">({player.userId})</span>
                          </td>
                          <td className="level-col">
                            <span className="level-badge">{player.level}</span>
                          </td>
                          <td className="xp-col">
                            <div className="xp-bar-container">
                              <div className="xp-bar-progress" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                            <span className="xp-fraction">{player.xp} / {xpNeeded} XP</span>
                          </td>
                          <td className="time-col">
                            {new Date(player.lastActive).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty-row">No leveling entries found for this server. Send chat messages to rank up!</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* Live Stream / Console Tab Content */}
        {activeTab === 'live' && (
          <div className="tab-pane live-monitor-pane">
            <div className="live-layout">
              {/* Left Column: Live Terminal Events */}
              <div className="live-events-panel glass-panel">
                <div className="panel-header">
                  <h2>Live Audit Log Feed</h2>
                  <span className="live-status-indicator">
                    <span className={`pulse-dot ${isConnected ? 'green' : 'gray'}`}></span>
                    {isConnected ? 'LIVE FEED CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
                <p className="section-subtitle">Real-time Discord event logging console (displays message edits, deletions, commands, joins).</p>
                
                <div className="terminal-log-console">
                  {liveLogs.map((log, idx) => {
                    const timeStr = new Date(log.timestamp).toLocaleTimeString();
                    
                    let eventBadgeClass = 'badge-info';
                    let eventTypeLabel = log.type;
                    
                    if (log.type === 'messageCreate') {
                      eventBadgeClass = 'badge-msg';
                      eventTypeLabel = 'MSG SENT';
                    } else if (log.type === 'messageDelete') {
                      eventBadgeClass = 'badge-del';
                      eventTypeLabel = 'MSG DEL';
                    } else if (log.type === 'messageUpdate') {
                      eventBadgeClass = 'badge-edit';
                      eventTypeLabel = 'MSG EDIT';
                    } else if (log.type === 'interactionCreate') {
                      eventBadgeClass = 'badge-cmd';
                      eventTypeLabel = 'SLASH CMD';
                    } else if (log.type === 'guildMemberAdd') {
                      eventBadgeClass = 'badge-join';
                      eventTypeLabel = 'JOIN';
                    } else if (log.type === 'guildMemberRemove') {
                      eventBadgeClass = 'badge-leave';
                      eventTypeLabel = 'LEAVE';
                    }

                    return (
                      <div key={idx} className="terminal-line">
                        <span className="terminal-time">[{timeStr}]</span>
                        <span className={`terminal-badge ${eventBadgeClass}`}>{eventTypeLabel}</span>
                        <span className="terminal-guild">({log.guildName || 'DM'})</span>
                        <span className="terminal-author">@{log.author}:</span>
                        <span className="terminal-content">
                          {log.type === 'messageUpdate' ? (
                            <>
                              <span className="old-text">{log.oldContent}</span>
                              <span className="arrow-split"> ➔ </span>
                              <span className="new-text">{log.newContent}</span>
                            </>
                          ) : (
                            log.content || log.newContent || '*(No content)*'
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {liveLogs.length === 0 && (
                    <div className="empty-terminal">
                      <Terminal size={40} className="terminal-empty-icon" />
                      <p>Listening for Discord events...</p>
                      <span>Try sending, editing, or deleting a message in your Discord server.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Message Dispatcher */}
              <div className="live-dispatcher-panel glass-panel">
                <h2>Live Channel Dispatcher</h2>
                <p className="section-subtitle">Send a message to a Discord channel directly through this dashboard as the bot.</p>
                
                <div className="dispatcher-form">
                  <div className="form-group">
                    <label>Target Text Channel</label>
                    <select
                      value={selectedChannelId}
                      onChange={(e) => setSelectedChannelId(e.target.value)}
                      className="form-control"
                      disabled={channels.length === 0}
                    >
                      {channels.length > 0 ? (
                        channels.map(ch => (
                          <option key={ch.id} value={ch.id}>#{ch.name}</option>
                        ))
                      ) : (
                        <option value="">-- No channels found / loading --</option>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Message Content</label>
                    <textarea
                      value={dispatchMessage}
                      onChange={(e) => setDispatchMessage(e.target.value)}
                      className="form-control text-area-message"
                      placeholder="Type a message to send to Discord..."
                      rows={4}
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!selectedChannelId || !dispatchMessage.trim()) return;
                      setDispatchStatus('sending');
                      socket.emit('send_message', {
                        guildId: selectedGuildId,
                        channelId: selectedChannelId,
                        content: dispatchMessage
                      });
                    }}
                    className="btn-send-message"
                    disabled={!isConnected || !selectedChannelId || !dispatchMessage.trim() || dispatchStatus === 'sending'}
                  >
                    <Send size={16} />
                    <span>{dispatchStatus === 'sending' ? 'Sending...' : 'Send Message'}</span>
                  </button>

                  {dispatchStatus === 'success' && (
                    <div className="dispatch-alert alert-success">
                      <CheckCircle size={16} />
                      <span>Message sent successfully!</span>
                    </div>
                  )}
                  {dispatchStatus === 'error' && (
                    <div className="dispatch-alert alert-danger">
                      <XCircle size={16} />
                      <span>{dispatchError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Notifications Toast Overlay */}
      <div className="toast-notifications-container">
        {notifications.map(n => (
          <div key={n.id} className={`toast-notification ${n.type}`}>
            <Bell size={18} />
            <div className="toast-content">
              <h4>{n.title}</h4>
              <p>{n.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
