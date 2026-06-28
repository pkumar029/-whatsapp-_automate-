import { useState, useEffect, useCallback } from 'react'
import { 
  Zap, Plus, Play, Pause, Trash2, Edit2, Search, X, Check, 
  ChevronDown, ChevronUp, GripVertical, MessageSquare, Clock, 
  Sliders, User, Users, FileText, HelpCircle 
} from 'lucide-react'
import { automationsApi } from '../../services/api'
import { formatIST } from '../../utils/date'
import { getErrorMessage } from '../../utils/error'

const TRIGGER_TYPES = ['keyword', 'schedule', 'contact_added', 'message_received', 'manual']
const STEP_TYPES = ['send_message', 'delay', 'condition', 'update_contact', 'webhook', 'log']

// ─── Trigger Card Component ──────────────────────────────────
function TriggerCard({ type, keyword, cron }) {
  let label = "Manual Trigger"
  let details = "Triggered manually by user or API request"
  if (type === 'keyword') {
    label = "Keyword Trigger"
    details = `Incoming message matches "${keyword}"`
  } else if (type === 'schedule') {
    label = "Schedule Trigger"
    details = `Cron schedule: "${cron}"`
  } else if (type === 'contact_added') {
    label = "Contact Added Trigger"
    details = "Triggers when a new contact is synced"
  } else if (type === 'message_received') {
    label = "Message Received Trigger"
    details = "Triggers on any incoming message"
  }
  
  return (
    <div style={{
      background: 'rgba(139, 92, 246, 0.12)',
      border: '1px dashed var(--accent-purple)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'var(--accent-purple)',
        color: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Zap size={15} />
      </div>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
          {details}
        </div>
      </div>
    </div>
  )
}

// ─── Flow Arrow Connector ────────────────────────────────────
function FlowArrow({ onInsert }) {
  const [hovered, setHovered] = useState(false)
  
  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        margin: '4px 0',
        position: 'relative',
        height: 28,
        width: '100%'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ 
        width: 2, 
        height: '100%', 
        background: hovered ? 'var(--accent-primary)' : 'var(--border-primary)',
        transition: 'background 0.2s'
      }} />
      
      <div style={{ 
        position: 'absolute',
        bottom: 0,
        width: 0,
        height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: `6px solid ${hovered ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
        transition: 'border-top-color 0.2s'
      }} />
      
      {onInsert && (
        <button 
          type="button"
          onClick={onInsert}
          style={{
            position: 'absolute',
            background: 'var(--bg-tertiary)',
            border: `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
            color: hovered ? 'var(--text-primary)' : 'var(--text-muted)',
            borderRadius: '50%',
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            zIndex: 5,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'all 0.2s',
            padding: 0
          }}
          title="Insert step here"
        >
          <Plus size={10} />
        </button>
      )}
    </div>
  )
}

// ─── Step Node Card Component ────────────────────────────────
function StepNode({ step, index, totalSteps, onUpdate, onDelete, onMoveUp, onMoveDown, triggerType }) {
  const [expanded, setExpanded] = useState(false)
  
  let config = {}
  try {
    config = typeof step.config === 'string' ? JSON.parse(step.config || '{}') : (step.config || {})
  } catch (e) {
    config = {}
  }

  const updateConfigField = (key, val) => {
    const newConfig = { ...config, [key]: val }
    onUpdate({ ...step, config: newConfig })
  }

  let stepIcon = <FileText size={14} />
  let stepColor = 'var(--accent-blue)'
  let stepBg = 'rgba(59, 130, 246, 0.12)'
  let stepLabel = 'Step'
  let stepSummary = ''

  if (step.step_type === 'send_message') {
    stepIcon = <MessageSquare size={14} />
    stepColor = 'var(--accent-primary)'
    stepBg = 'rgba(37, 211, 102, 0.12)'
    stepLabel = 'Send WhatsApp Message'
    stepSummary = config.message ? `"${config.message.slice(0, 36)}${config.message.length > 36 ? '...' : ''}"` : 'Configure message text'
  } else if (step.step_type === 'delay') {
    stepIcon = <Clock size={14} />
    stepColor = 'var(--accent-amber)'
    stepBg = 'rgba(245, 158, 11, 0.12)'
    stepLabel = 'Wait Delay'
    stepSummary = config.seconds ? `Pause for ${config.seconds} seconds` : 'Set delay time'
  } else if (step.step_type === 'condition') {
    stepIcon = <Sliders size={14} />
    stepColor = 'var(--accent-rose)'
    stepBg = 'rgba(239, 68, 68, 0.12)'
    stepLabel = 'If/Else Condition'
    stepSummary = config.field ? `Check if contact.${config.field} ${config.operator || 'equals'} "${config.value || ''}"` : 'Set matching rule'
  } else if (step.step_type === 'update_contact') {
    stepIcon = <User size={14} />
    stepColor = 'var(--accent-indigo)'
    stepBg = 'rgba(99, 102, 241, 0.12)'
    stepLabel = 'Update Contact'
    stepSummary = (config.name || config.email) ? `Set name: ${config.name || '—'}, email: ${config.email || '—'}` : 'Configure contact updates'
  } else if (step.step_type === 'webhook') {
    stepIcon = <Zap size={14} stroke="var(--accent-purple)" />
    stepColor = 'var(--accent-purple)'
    stepBg = 'rgba(139, 92, 246, 0.12)'
    stepLabel = 'Trigger Webhook'
    stepSummary = config.url ? `POST to ${config.url.slice(0, 32)}${config.url.length > 32 ? '...' : ''}` : 'Configure API endpoint'
  } else if (step.step_type === 'log') {
    stepIcon = <FileText size={14} />
    stepColor = 'var(--text-secondary)'
    stepBg = 'rgba(156, 163, 175, 0.12)'
    stepLabel = 'Write Activity Log'
    stepSummary = config.message ? `Log: "${config.message}"` : 'Log text'
  }

  return (
    <div style={{ 
      background: 'var(--bg-tertiary)', 
      border: `1px solid ${expanded ? stepColor : 'var(--border-primary)'}`, 
      borderRadius: 'var(--radius-md)', 
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      width: '100%',
      transition: 'all 0.2s'
    }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12, 
          padding: '10px 14px', 
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid var(--border-primary)' : 'none'
        }} 
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ 
          width: 30, 
          height: 30, 
          borderRadius: 'var(--radius-md)', 
          background: stepBg, 
          color: stepColor, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexShrink: 0 
        }}>
          {stepIcon}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Step {index + 1}: {stepLabel}</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stepSummary}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
          {index > 0 && (
            <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={onMoveUp} title="Move Up" style={{ height: 26, width: 26 }}><ChevronUp size={12} /></button>
          )}
          {index < totalSteps - 1 && (
            <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={onMoveDown} title="Move Down" style={{ height: 26, width: 26 }}><ChevronDown size={12} /></button>
          )}
          <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={onDelete} title="Delete Step" style={{ height: 26, width: 26 }}><Trash2 size={12} /></button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: 14 }}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Action Type</label>
            <select 
              className="form-input form-select" 
              style={{ padding: '6px 10px', fontSize: 12, height: 32 }} 
              value={step.step_type} 
              onChange={e => {
                const nextType = e.target.value
                let defaultConf = {}
                if (nextType === 'delay') defaultConf = { seconds: 1 }
                else if (nextType === 'send_message') defaultConf = { message: '' }
                else if (nextType === 'condition') defaultConf = { field: 'name', operator: 'equals', value: '' }
                else if (nextType === 'update_contact') defaultConf = { name: '', email: '' }
                else if (nextType === 'webhook') defaultConf = { url: '' }
                else if (nextType === 'log') defaultConf = { message: '' }
                
                onUpdate({ ...step, step_type: nextType, config: defaultConf })
              }}
            >
              {STEP_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
          </div>

          {step.step_type === 'send_message' && (
            <div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Message Text *</label>
                <textarea 
                  className="form-input form-textarea" 
                  style={{ minHeight: 60, fontSize: 12, padding: 8 }}
                  value={config.message || ''} 
                  onChange={e => updateConfigField('message', e.target.value)}
                  placeholder="Type your message here..."
                />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                  Write a standard text message. You can optionally use {"{{name}}"} to dynamically insert contact names.
                </span>
              </div>

              {(() => {
                const recipientMode = config.target_type === 'group' 
                  ? 'group' 
                  : ((config.phone && config.phone !== '') ? 'custom' : 'active');
                
                const isScheduledOrManual = triggerType === 'schedule' || triggerType === 'manual';
                const activeMode = isScheduledOrManual ? 'custom' : (recipientMode === 'active' && config.target_type === 'group' ? 'group' : recipientMode);

                return (
                  <>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Recipient Type *</label>
                      <select 
                        className="form-input" 
                        style={{ padding: '4px 8px', fontSize: 12, height: 32 }}
                        value={activeMode}
                        onChange={e => {
                          const nextMode = e.target.value;
                          if (nextMode === 'group') {
                            onUpdate({
                              ...step,
                              config: {
                                ...config,
                                target_type: 'group',
                                target_tag: config.target_tag || 'all',
                                stagger_seconds: config.stagger_seconds || 5,
                                phone: ''
                              }
                            });
                          } else if (nextMode === 'custom') {
                            onUpdate({
                              ...step,
                              config: {
                                ...config,
                                target_type: 'single',
                                phone: (config.phone && config.phone !== '') ? config.phone : '+91xxxxxxxx'
                              }
                            });
                          } else {
                            onUpdate({
                              ...step,
                              config: {
                                ...config,
                                target_type: 'single',
                                phone: ''
                              }
                            });
                          }
                        }}
                      >
                        {!isScheduledOrManual && (
                          <option value="active">Active Contact (Dynamic Response)</option>
                        )}
                        <option value="custom">Enter Custom Number (Static)</option>
                        <option value="group">Loop Group / Tag (Bulk Broadcast)</option>
                      </select>
                    </div>

                    {activeMode === 'group' && (
                      <div style={{ display: 'flex', gap: 10, marginBottom: 0 }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: 11 }}>Target Group / Tag *</label>
                          <select
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: 12, height: 32 }}
                            value={config.target_tag || 'all'}
                            onChange={e => updateConfigField('target_tag', e.target.value)}
                          >
                            <option value="all">All Contacts</option>
                            <option value="whatsapp_groups">All WhatsApp Groups</option>
                            <option value="leads">leads</option>
                            <option value="customers">customers</option>
                            <option value="vip">vip</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: 11 }}>Stagger Delay (s) *</label>
                          <input
                            type="number"
                            className="form-input"
                            style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                            min="0"
                            value={config.stagger_seconds || 5}
                            onChange={e => updateConfigField('stagger_seconds', parseInt(e.target.value, 10) || 0)}
                          />
                        </div>
                      </div>
                    )}

                    {activeMode === 'custom' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Recipient Phone *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                          value={config.phone || ''} 
                          onChange={e => updateConfigField('phone', e.target.value)}
                          placeholder="+91xxxxxxxx"
                        />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                          ⚠️ Enter a static recipient phone number with country code (e.g. +91xxxxxxxx).
                        </span>
                      </div>
                    )}

                    {activeMode === 'active' && (
                      <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', fontSize: 11, color: 'var(--text-muted)' }}>
                        ℹ️ This step will automatically respond to whichever contact sends the triggering WhatsApp message.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {step.step_type === 'delay' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Delay Duration (Seconds) *</label>
              <input 
                type="number" 
                className="form-input" 
                style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                min="1" 
                value={config.seconds || 1} 
                onChange={e => updateConfigField('seconds', parseInt(e.target.value) || 1)}
              />
            </div>
          )}

          {step.step_type === 'condition' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Field *</label>
                <select 
                  className="form-input form-select" 
                  style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                  value={config.field || 'name'} 
                  onChange={e => updateConfigField('field', e.target.value)}
                >
                  <option value="name">Contact Name</option>
                  <option value="phone">Phone Number</option>
                  <option value="email">Email</option>
                  <option value="content">Message Content</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Operator *</label>
                <select 
                  className="form-input form-select" 
                  style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                  value={config.operator || 'equals'} 
                  onChange={e => updateConfigField('operator', e.target.value)}
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                  <option value="contains">Contains</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Value *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                  value={config.value || ''} 
                  onChange={e => updateConfigField('value', e.target.value)}
                  placeholder="e.g. Sales"
                />
              </div>
            </div>
          )}

          {step.step_type === 'update_contact' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Update Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                  value={config.name || ''} 
                  onChange={e => updateConfigField('name', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Update Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                  value={config.email || ''} 
                  onChange={e => updateConfigField('email', e.target.value)}
                />
              </div>
            </div>
          )}

          {step.step_type === 'webhook' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Webhook URL *</label>
              <input 
                type="url" 
                className="form-input" 
                style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                value={config.url || ''} 
                onChange={e => updateConfigField('url', e.target.value)}
                placeholder="https://mycrm.com/webhook"
              />
            </div>
          )}

          {step.step_type === 'log' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Log Message *</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                value={config.message || ''} 
                onChange={e => updateConfigField('message', e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── End Node Component ──────────────────────────────────────
function EndNode() {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%'
    }}>
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        End Workflow Flow
      </span>
    </div>
  )
}

// Helper to parse cron string for builder
const parseCron = (cronStr) => {
  if (!cronStr) return { type: 'minutes', value: 5, time: '12:00' }
  const parts = cronStr.trim().split(/\s+/)
  
  if (parts.length === 6 && parts[0].startsWith('*/')) {
    const val = parseInt(parts[0].replace('*/', ''), 10)
    return { type: 'seconds', value: isNaN(val) ? 10 : val, time: '12:00' }
  }
  
  if (parts.length === 5 && parts[0].startsWith('*/')) {
    const val = parseInt(parts[0].replace('*/', ''), 10)
    return { type: 'minutes', value: isNaN(val) ? 5 : val, time: '12:00' }
  }
  
  if (parts.length === 5 && parts[0] === '0' && parts[1].startsWith('*/')) {
    const val = parseInt(parts[1].replace('*/', ''), 10)
    return { type: 'hours', value: isNaN(val) ? 1 : val, time: '12:00' }
  }
  
  if (parts.length === 5 && !parts[0].includes('*') && !parts[1].includes('*') && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
    const min = parts[0].padStart(2, '0')
    const hr = parts[1].padStart(2, '0')
    return { type: 'daily', value: 1, time: `${hr}:${min}` }
  }
  
  return { type: 'custom', value: 5, time: '12:00' }
}

// ─── Automation Modal ─────────────────────────────────────────
function AutomationModal({ automation, onClose, onSave }) {
  const [form, setForm] = useState({
    name: automation?.name || '',
    description: automation?.description || '',
    trigger_type: automation?.trigger_type || 'manual',
  })
  const [triggerKeyword, setTriggerKeyword] = useState(
    automation?.trigger_type === 'keyword' ? automation.trigger_config?.keyword || '' : ''
  )
  const [triggerCron, setTriggerCron] = useState(
    automation?.trigger_type === 'schedule' ? automation.trigger_config?.cron || '' : ''
  )
  const [scheduleBuilder, setScheduleBuilder] = useState(() => {
    const initialCron = automation?.trigger_type === 'schedule' ? automation.trigger_config?.cron || '' : ''
    return parseCron(initialCron)
  })
  const [steps, setSteps] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (automation) {
      setForm({
        name: automation.name || '',
        description: automation.description || '',
        trigger_type: automation.trigger_type || 'manual',
      })
      setTriggerKeyword(automation.trigger_type === 'keyword' ? automation.trigger_config?.keyword || '' : '')
      const initialCron = automation.trigger_type === 'schedule' ? automation.trigger_config?.cron || '' : ''
      setTriggerCron(initialCron)
      setScheduleBuilder(parseCron(initialCron))
    }
    if (automation?.id) {
      automationsApi.getSteps(automation.id)
        .then(res => {
          setSteps(res.data || [])
        })
        .catch(err => {
          setError('Failed to load automation steps.')
        })
    } else {
      setSteps([])
    }
  }, [automation])

  useEffect(() => {
    if (form.trigger_type === 'schedule') {
      const { type, value, time } = scheduleBuilder
      if (type === 'custom') return
      
      if (type === 'seconds') {
        setTriggerCron(`*/${value} * * * * *`)
      } else if (type === 'minutes') {
        setTriggerCron(`*/${value} * * * *`)
      } else if (type === 'hours') {
        setTriggerCron(`0 */${value} * * *`)
      } else if (type === 'daily') {
        const [hr, min] = time.split(':')
        const h = parseInt(hr, 10) || 0
        const m = parseInt(min, 10) || 0
        setTriggerCron(`${m} ${h} * * *`)
      }
    }
  }, [scheduleBuilder, form.trigger_type])

  const addStep = () => {
    setSteps([...steps, { step_type: 'send_message', step_order: steps.length + 1, config: {} }])
  }

  const insertStepAt = (index) => {
    const newSteps = [...steps]
    newSteps.splice(index, 0, { step_type: 'send_message', step_order: index + 1, config: {} })
    const reordered = newSteps.map((s, idx) => ({ ...s, step_order: idx + 1 }))
    setSteps(reordered)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Automation name is required.'); return }
    setSaving(true); setError('')
    try {
      let parsedTriggerConfig = {}
      if (form.trigger_type === 'keyword') {
        if (!triggerKeyword.trim()) {
          setError('Trigger keyword is required.')
          setSaving(false)
          return
        }
        parsedTriggerConfig = { keyword: triggerKeyword.trim() }
      } else if (form.trigger_type === 'schedule') {
        if (!triggerCron.trim()) {
          setError('Cron schedule configuration is required.')
          setSaving(false)
          return
        }
        parsedTriggerConfig = { cron: triggerCron.trim() }
      }

      const parsedSteps = steps.map((s, idx) => {
        let parsedConfig = {}
        if (typeof s.config === 'string') {
          try {
            parsedConfig = JSON.parse(s.config || '{}')
          } catch (e) {
            throw new Error(`Invalid JSON in Step #${idx + 1} configuration.`)
          }
        } else {
          parsedConfig = s.config || {}
        }
        const { id, automation_id, created_at, updated_at, ...cleanStep } = s
        return {
          ...cleanStep,
          step_order: idx + 1,
          config: parsedConfig
        }
      })

      const payload = { 
        ...form, 
        trigger_config: parsedTriggerConfig, 
        steps: parsedSteps 
      }

      if (automation?.id) { 
        await automationsApi.update(automation.id, payload) 
      } else { 
        await automationsApi.create(payload) 
      }
      onSave()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally { 
      setSaving(false) 
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 className="modal-title">{automation ? 'Edit Automation' : 'New Automation'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSave}>
          {error && <div style={{ background: 'var(--accent-rose-muted)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)' }}>{error}</div>}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" placeholder="Enter a name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Trigger Type</label>
              <select className="form-input form-select" value={form.trigger_type} onChange={e => setForm({ ...form, trigger_type: e.target.value })}>
                {TRIGGER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="What does this automation do?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          {form.trigger_type === 'keyword' && (
            <div className="form-group">
              <label className="form-label">Trigger Keyword *</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. support" 
                value={triggerKeyword} 
                onChange={e => setTriggerKeyword(e.target.value)} 
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Runs workflow when an incoming WhatsApp message exactly matches this keyword.
              </span>
            </div>
          )}
          {form.trigger_type === 'schedule' && (
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Schedule Trigger Builder</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  {[
                    { id: 'seconds', label: 'Seconds' },
                    { id: 'minutes', label: 'Minutes' },
                    { id: 'hours', label: 'Hours' },
                    { id: 'daily', label: 'Daily Time' },
                    { id: 'custom', label: 'Custom Cron' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setScheduleBuilder(prev => ({ ...prev, type: opt.id }))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid var(--border-primary)',
                        cursor: 'pointer',
                        background: scheduleBuilder.type === opt.id ? 'var(--accent-primary-muted)' : 'rgba(255,255,255,0.02)',
                        color: scheduleBuilder.type === opt.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {scheduleBuilder.type !== 'custom' && scheduleBuilder.type !== 'daily' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Run Every (Value) *</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                    value={scheduleBuilder.value}
                    onChange={e => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1)
                      setScheduleBuilder(prev => ({ ...prev, value: val }))
                    }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Runs the workflow automatically every {scheduleBuilder.value} {scheduleBuilder.type}.
                  </span>
                </div>
              )}

              {scheduleBuilder.type === 'daily' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Daily Run Time *</label>
                  <input
                    type="time"
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                    value={scheduleBuilder.time}
                    onChange={e => {
                      const val = e.target.value || '12:00'
                      setScheduleBuilder(prev => ({ ...prev, time: val }))
                    }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Runs the workflow automatically every day at {scheduleBuilder.time}.
                  </span>
                </div>
              )}

              {scheduleBuilder.type === 'custom' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Cron Expression *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. */5 * * * * (every 5 minutes)" 
                    value={triggerCron} 
                    onChange={e => setTriggerCron(e.target.value)} 
                    style={{ padding: '6px 10px', fontSize: 12, height: 32 }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Standard crontab format: minute, hour, day-of-month, month, day-of-week.
                  </span>
                </div>
              )}
            </div>
          )}
          {form.trigger_type === 'contact_added' && (
            <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              ℹ️ Triggers automatically whenever a new contact is added. No configuration required.
            </div>
          )}
          {form.trigger_type === 'message_received' && (
            <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              ℹ️ Triggers automatically on any incoming message. No configuration required.
            </div>
          )}
          
          <div style={{ borderTop: '1px solid var(--border-primary)', margin: '16px 0', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Visual Workflow Canvas</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addStep}><Plus size={14} /> Add Step</button>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              background: 'var(--bg-secondary)', 
              borderRadius: 'var(--radius-lg)', 
              border: '1px solid var(--border-primary)', 
              padding: 16,
              gap: 0
            }}>
              <TriggerCard type={form.trigger_type} keyword={triggerKeyword} cron={triggerCron} />
              
              {steps.length > 0 && <FlowArrow onInsert={() => insertStepAt(0)} />}
              
              {steps.map((step, i) => (
                <div key={i} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <StepNode
                    step={step}
                    index={i}
                    totalSteps={steps.length}
                    triggerType={form.trigger_type}
                    onUpdate={updated => setSteps(steps.map((s, idx) => idx === i ? updated : s))}
                    onDelete={() => setSteps(steps.filter((_, idx) => idx !== i))}
                    onMoveUp={() => {
                      const newSteps = [...steps]
                      const temp = newSteps[i]
                      newSteps[i] = newSteps[i - 1]
                      newSteps[i - 1] = temp
                      setSteps(newSteps)
                    }}
                    onMoveDown={() => {
                      const newSteps = [...steps]
                      const temp = newSteps[i]
                      newSteps[i] = newSteps[i + 1]
                      newSteps[i + 1] = temp
                      setSteps(newSteps)
                    }}
                  />
                  <FlowArrow onInsert={() => insertStepAt(i + 1)} />
                </div>
              ))}
              
              <EndNode />
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : <><Check size={15} /> Save Automation</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Automations Page ────────────────────────────────────
export default function Automations() {
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const fetchAutomations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await automationsApi.getAll({ search })
      setAutomations(res.data?.automations || res.data || [])
    } catch { setAutomations([]) } finally { setLoading(false) }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchAutomations, 300)
    return () => clearTimeout(t)
  }, [fetchAutomations])

  const toggleStatus = async (automation) => {
    try {
      if (automation.is_active) { await automationsApi.deactivate(automation.id) }
      else { await automationsApi.activate(automation.id) }
      fetchAutomations()
    } catch { }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this automation?')) return
    try { await automationsApi.delete(id); fetchAutomations() } catch { }
  }

  const handleRun = async (id) => {
    try { await automationsApi.run(id); alert('Automation triggered!') } catch { }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Automations</h2>
          <p className="page-subtitle">Build and manage your WhatsApp workflows</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowModal(true) }}>
          <Plus size={16} /> New Automation
        </button>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-bar">
            <Search size={15} className="search-bar-icon" />
            <input className="form-input" placeholder="Search automations..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading automations...</div>
        ) : automations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Zap size={28} /></div>
            <div className="empty-state-title">No automations yet</div>
            <div className="empty-state-desc">Create your first WhatsApp automation workflow</div>
            <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowModal(true) }}><Plus size={16} /> Create Automation</button>
          </div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Trigger</th><th>Steps</th><th>Status</th><th>Last Run</th><th>Actions</th></tr></thead>
            <tbody>
              {automations.map(a => (
                <tr key={a.id}>
                  <td>
                    <div className="td-primary">{a.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{a.description}</div>
                  </td>
                  <td><span className="badge badge-purple">{a.trigger_type?.replace(/_/g, ' ')}</span></td>
                  <td><span className="badge badge-gray">{a.step_count || 0} steps</span></td>
                  <td>
                    <span className={`badge ${a.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {a.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {a.last_run ? formatIST(a.last_run) : 'Never'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleRun(a.id)} title="Run Now"><Play size={13} /></button>
                      <button className={`btn btn-icon btn-sm ${a.is_active ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => toggleStatus(a)} title={a.is_active ? 'Pause' : 'Activate'}>
                        {a.is_active ? <Pause size={13} /> : <Play size={13} color="var(--accent-primary)" />}
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditItem(a); setShowModal(true) }}><Edit2 size={13} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(a.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <AutomationModal automation={editItem} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchAutomations() }} />}
    </div>
  )
}
