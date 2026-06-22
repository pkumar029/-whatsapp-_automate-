import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  MessageSquare, Send, Search, Phone, Video, Paperclip, 
  FileText, Image as ImageIcon, MapPin, X, HelpCircle, 
  Check, CheckCheck, Clock, AlertCircle, User 
} from 'lucide-react'
import { messagesApi, contactsApi } from '../../services/api'
import { formatISTTime } from '../../utils/date'
import { getErrorMessage } from '../../utils/error'


export default function Messages() {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [messages, setMessages] = useState([])
  const [searchContact, setSearchContact] = useState('')
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  
  // Modals / Dropdowns
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [callModal, setCallModal] = useState(null) // 'voice' | 'video' | null
  const [attachModal, setAttachModal] = useState(null) // 'file' | 'image' | 'location' | null
  
  // Attachments form inputs
  const [attachName, setAttachName] = useState('')
  const [attachUrl, setAttachUrl] = useState('')

  const chatEndRef = useRef(null)

  // Fetch contacts list
  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true)
    try {
      const res = await contactsApi.getAll({ limit: 100 })
      const contactsList = res.data?.contacts || res.data || []
      setContacts(contactsList)
      if (contactsList.length > 0 && !selectedContact) {
        setSelectedContact(contactsList[0])
      }
    } catch (err) {
      setContacts([])
    } finally {
      setLoadingContacts(false)
    }
  }, [selectedContact])

  // Fetch messages for selected contact
  const fetchMessages = useCallback(async () => {
    if (!selectedContact) return
    setLoadingMessages(true)
    try {
      const res = await messagesApi.getAll({ contact_id: selectedContact.id, limit: 100 })
      const msgList = res.data?.messages || res.data || []
      // Sort messages chronological (oldest first for chat window)
      const sorted = [...msgList].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      setMessages(sorted)
    } catch {
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [selectedContact])

  useEffect(() => {
    fetchContacts()
  }, [])

  useEffect(() => {
    fetchMessages()
    // Poll messages every 5 seconds for real-time inbound updates
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [selectedContact])

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle Send Message
  const handleSend = async (textToSend, mediaInfo = null) => {
    if (!selectedContact) return
    const payload = {
      contact_id: selectedContact.id,
      phone: selectedContact.phone,
      message: textToSend
    }
    
    // In a real application with media upload, we would pass media_url and media_type.
    // Our backend Message schema supports these fields, so we can save it!
    if (mediaInfo) {
      payload.media_url = mediaInfo.url
      payload.media_type = mediaInfo.type
    }

    try {
      await messagesApi.send(payload)
      setNewMessage('')
      fetchMessages()
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to send message.'))
    }
  }

  // Handle Attachment Submit
  const handleAttachSubmit = (e) => {
    e.preventDefault()
    if (!attachName) return
    
    const typeLabel = attachModal === 'file' ? '📄 Document' : attachModal === 'image' ? '🖼️ Image' : '📍 Location'
    const simulatedMsg = `${typeLabel}: ${attachName} (${attachUrl || 'Attached File'})`
    
    handleSend(simulatedMsg, {
      url: attachUrl || 'http://example.com/file',
      type: attachModal
    })

    // Reset attachment form
    setAttachModal(null)
    setAttachName('')
    setAttachUrl('')
  }

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchContact.toLowerCase()) ||
    c.phone.includes(searchContact)
  )

  const statusIcon = (status) => {
    if (status === 'delivered') return <CheckCheck size={14} color="var(--accent-primary)" />
    if (status === 'sent') return <Check size={14} color="var(--text-muted)" />
    if (status === 'read') return <CheckCheck size={14} color="#53bdeb" />
    if (status === 'failed') return <AlertCircle size={14} color="var(--accent-rose)" />
    return <Clock size={14} color="var(--text-muted)" />
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
      
      {/* ─── LEFT SIDEBAR: CONTACTS LIST ─── */}
      <div style={{ width: '320px', borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', background: 'var(--bg-tertiary)' }}>
        
        {/* Search Contacts */}
        <div style={{ padding: 14, borderBottom: '1px solid var(--border-primary)' }}>
          <div className="search-bar" style={{ width: '100%' }}>
            <Search size={14} className="search-bar-icon" />
            <input
              className="form-input"
              placeholder="Search chats..."
              value={searchContact}
              onChange={e => setSearchContact(e.target.value)}
              style={{ paddingLeft: 34, width: '100%', height: 36 }}
            />
          </div>
        </div>

        {/* Contacts Scroller */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingContacts ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Loading chats...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
              No contacts found. Link your WhatsApp or add contacts to sync.
            </div>
          ) : (
            filteredContacts.map(c => {
              const isSelected = selectedContact?.id === c.id
              return (
                <div 
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-primary)',
                    background: isSelected ? 'rgba(37, 211, 102, 0.08)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: isSelected ? 'var(--accent-primary)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? '#000' : 'var(--accent-primary)', fontWeight: 700 }}>
                    {c.name[0]?.toUpperCase()}
                  </div>
                  {/* Name/Phone */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                      {c.phone}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ─── RIGHT SIDEBAR: CHAT WINDOW ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
        
        {selectedContact ? (
          <>
            {/* Chat Window Header */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', fontWeight: 700 }}>
                  {selectedContact.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                    {selectedContact.name}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-primary)' }}>
                    Active WhatsApp Chat
                  </div>
                </div>
              </div>

              {/* Call and Video Call access actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-icon" onClick={() => setCallModal('voice')} title="Audio Call">
                  <Phone size={15} />
                </button>
                <button className="btn btn-secondary btn-icon" onClick={() => setCallModal('video')} title="Video Call">
                  <Video size={15} />
                </button>
              </div>
            </div>

            {/* Chat Body (Scrollable Messages Area) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-secondary)' }}>
              
              {loadingMessages && messages.length === 0 ? (
                <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Loading chat history...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                  <MessageSquare size={36} style={{ margin: '0 auto 12px', color: 'var(--border-primary)' }} />
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>No messages yet</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>Type a message below to start the conversation.</div>
                </div>
              ) : (
                messages.map(m => {
                  const isOutbound = m.direction === 'outbound'
                  return (
                    <div 
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: isOutbound ? 'flex-end' : 'flex-start',
                        width: '100%'
                      }}
                    >
                      <div 
                        style={{
                          maxWidth: '70%',
                          background: isOutbound ? 'var(--accent-primary-muted)' : 'var(--bg-tertiary)',
                          border: isOutbound ? '1px solid rgba(37, 211, 102, 0.2)' : '1px solid var(--border-primary)',
                          padding: '8px 12px',
                          borderRadius: isOutbound ? '12px 12px 0 12px' : '12px 12px 12px 0',
                          color: 'var(--text-primary)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}
                      >
                        {/* Text Content */}
                        <div style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
                          {m.content}
                        </div>
                        
                        {/* Time & Delivery Status */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '10px', color: 'var(--text-muted)' }}>
                          {m.created_at ? formatISTTime(m.created_at) : ''}
                          {isOutbound && statusIcon(m.status)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div style={{ padding: 14, background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: 12, alignItems: 'center', position: 'relative' }}>
              
              {/* Attachment Actions */}
              <div style={{ position: 'relative' }}>
                <button 
                  className="btn btn-secondary btn-icon" 
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  style={{ background: showAttachMenu ? 'var(--bg-hover)' : 'transparent' }}
                  title="Attach file"
                >
                  <Paperclip size={16} />
                </button>

                {showAttachMenu && (
                  <div style={{ position: 'absolute', bottom: '50px', left: 0, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: 6, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 100, width: 150, boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}>
                    {[
                      { id: 'file', label: 'Document', icon: <FileText size={14} /> },
                      { id: 'image', label: 'Image', icon: <ImageIcon size={14} /> },
                      { id: 'location', label: 'Location', icon: <MapPin size={14} /> },
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setAttachModal(item.id)
                          setShowAttachMenu(false)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 'var(--font-size-xs)'
                        }}
                        onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.target.style.background = 'transparent'}
                      >
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input Text Field */}
              <input
                className="form-input"
                placeholder="Type your WhatsApp message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newMessage.trim()) {
                    handleSend(newMessage)
                  }
                }}
                style={{ flex: 1, height: 38 }}
              />

              {/* Send Button */}
              <button 
                className="btn btn-primary btn-icon" 
                onClick={() => handleSend(newMessage)}
                disabled={!newMessage.trim()}
              >
                <Send size={15} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            <MessageSquare size={48} style={{ margin: '0 auto 16px', color: 'var(--border-primary)' }} />
            <h3>Your WhatsApp Chat Room</h3>
            <p style={{ maxWidth: 360, margin: '8px auto 0', fontSize: 'var(--font-size-sm)' }}>
              Select a contact from the left list to view messaging history and send direct WhatsApp messages.
            </p>
          </div>
        )}
      </div>

      {/* ─── CALLS / VIDEO CALLS ACCESS MODAL ─── */}
      {callModal && (
        <div className="modal-overlay" onClick={() => setCallModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle color="var(--accent-primary)" size={20} />
                WhatsApp {callModal === 'video' ? 'Video' : 'Voice'} Call Access
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setCallModal(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: '10px 0', fontSize: 'var(--font-size-sm)', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              <p>
                <strong>Voice and Video calling is a technical limitation</strong> of unofficial linked browser connections (WhatsApp Web API). 
              </p>
              <p style={{ marginTop: 10 }}>
                To place a call, please use the official WhatsApp app on your mobile phone or WhatsApp Desktop client linked to the same number.
              </p>
            </div>
            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => setCallModal(null)}>Acknowledge</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ATTACHMENT MODAL ─── */}
      {attachModal && (
        <div className="modal-overlay" onClick={() => setAttachModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Paperclip size={18} />
                Send {attachModal.toUpperCase()}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setAttachModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAttachSubmit}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">
                  {attachModal === 'file' && 'Document / File Name *'}
                  {attachModal === 'image' && 'Image Label / Caption *'}
                  {attachModal === 'location' && 'Location Name / Address *'}
                </label>
                <input
                  className="form-input"
                  placeholder={
                    attachModal === 'file' ? 'e.g. Invoice_2026.pdf' :
                    attachModal === 'image' ? 'e.g. Office_Screenshot.png' :
                    'e.g. Google HQ, Mountain View, CA'
                  }
                  value={attachName}
                  onChange={e => setAttachName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">
                  {attachModal === 'location' ? 'Coordinates / Lat-Long (Optional)' : 'File / Media URL (Optional)'}
                </label>
                <input
                  className="form-input"
                  placeholder={attachModal === 'location' ? 'e.g. 37.4220,-122.0841' : 'e.g. http://example.com/invoice.pdf'}
                  value={attachUrl}
                  onChange={e => setAttachUrl(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAttachModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Send size={14} /> Send Attachment</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
