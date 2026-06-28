import { useState, useEffect, useCallback } from 'react'
import {
  Zap, Plus, Play, Pause, Trash2, Edit2, Search, X, Check,
  ChevronDown, ChevronUp, MessageSquare, Clock, Sliders, User,
  FileText, Globe, Image, Tag, Smile, Copy, Activity,
  AlertCircle, CheckCircle, ToggleLeft, ToggleRight, FlaskConical,
  BookOpen, History, Timer
} from 'lucide-react'
import { automationsApi } from '../../services/api'
import { formatIST } from '../../utils/date'
import { getErrorMessage } from '../../utils/error'

// ─── Built-in Templates ────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome New Contact',
    description: 'Greet every new contact automatically when they are synced',
    emoji: '👋',
    trigger_type: 'contact_added',
    trigger_config: {},
    steps: [
      { step_type: 'send_message', step_order: 1, config: { message: 'Welcome {{name}}! 👋 Thanks for connecting. How can I help you today?' } },
      { step_type: 'add_tag', step_order: 2, config: { tag: 'new_contact' } },
    ],
  },
  {
    id: 'auto_reply_hello',
    name: 'Auto-Reply: Hello',
    description: 'Instantly reply when someone says hi, hello, or hey',
    emoji: '💬',
    trigger_type: 'keyword_pattern',
    trigger_config: { pattern: 'hello|hi|hey', match_mode: 'regex' },
    steps: [
      { step_type: 'react_message', step_order: 1, config: { emoji: '👍' } },
      { step_type: 'send_message', step_order: 2, config: { message: 'Hi {{name}}! 😊 Great to hear from you. How can I assist you today?' } },
    ],
  },
  {
    id: 'support_ticket',
    name: 'Support Ticket Handler',
    description: 'Auto-acknowledge support requests and tag the contact',
    emoji: '🎧',
    trigger_type: 'keyword',
    trigger_config: { keyword: 'support' },
    cooldown_minutes: 60,
    steps: [
      { step_type: 'react_message', step_order: 1, config: { emoji: '✅' } },
      { step_type: 'send_message', step_order: 2, config: { message: 'Hi {{name}}, your support request has been received! 🎧 Our team will get back to you within 24 hours.' } },
      { step_type: 'add_tag', step_order: 3, config: { tag: 'support' } },
      { step_type: 'log', step_order: 4, config: { message: 'Support ticket created for {{name}} ({{phone}})' } },
    ],
  },
  {
    id: 'order_confirm',
    name: 'Order Confirmation',
    description: 'Confirm orders when a message contains the word "order"',
    emoji: '📦',
    trigger_type: 'keyword_pattern',
    trigger_config: { pattern: 'order', match_mode: 'contains' },
    cooldown_minutes: 30,
    steps: [
      { step_type: 'send_message', step_order: 1, config: { message: 'Thank you for your order, {{name}}! 📦 Your order has been received and is being processed. We\'ll update you soon.' } },
      { step_type: 'add_tag', step_order: 2, config: { tag: 'customer' } },
    ],
  },
  {
    id: 'daily_broadcast',
    name: 'Daily Morning Broadcast',
    description: 'Send a message to all contacts every morning at 9am',
    emoji: '🌅',
    trigger_type: 'schedule',
    trigger_config: { cron: '0 9 * * *' },
    steps: [
      { step_type: 'send_message', step_order: 1, config: { message: 'Good morning! 🌅 Hope you have a wonderful day. Feel free to reach out if you need anything.', target_type: 'group', target_tag: 'all', stagger_seconds: 5 } },
    ],
  },
  {
    id: 'vip_welcome',
    name: 'VIP Member Welcome',
    description: 'Send a special message whenever a contact gets the "vip" tag',
    emoji: '⭐',
    trigger_type: 'contact_tag_added',
    trigger_config: { tag: 'vip' },
    steps: [
      { step_type: 'send_message', step_order: 1, config: { message: '⭐ Welcome to VIP, {{name}}! You now have access to exclusive offers and priority support. Thank you for your loyalty!' } },
    ],
  },
  {
    id: 'follow_up',
    name: 'Follow-up Sequence',
    description: 'Send a follow-up message 10 seconds after initial interest',
    emoji: '🔄',
    trigger_type: 'keyword',
    trigger_config: { keyword: 'interested' },
    cooldown_minutes: 120,
    steps: [
      { step_type: 'send_message', step_order: 1, config: { message: 'Thanks for your interest, {{name}}! 🙏 Let me share some details with you.' } },
      { step_type: 'delay', step_order: 2, config: { seconds: 10 } },
      { step_type: 'send_message', step_order: 3, config: { message: '✅ Here\'s what we offer:\n\n• Premium quality\n• 24/7 support\n• Best price guarantee\n\nWould you like to know more? Just reply YES!' } },
      { step_type: 'add_tag', step_order: 4, config: { tag: 'leads' } },
    ],
  },
]

// ─── Trigger meta ─────────────────────────────────────────────
const TRIGGER_META = {
  keyword:          { label: 'Exact Keyword',      color: 'var(--accent-primary)',  desc: 'Incoming message exactly matches keyword' },
  keyword_pattern:  { label: 'Keyword Pattern',    color: 'var(--accent-amber)',    desc: 'Message contains / matches pattern' },
  schedule:         { label: 'Scheduled',          color: 'var(--accent-indigo)',   desc: 'Runs on a cron schedule' },
  contact_added:    { label: 'Contact Added',      color: 'var(--accent-blue)',     desc: 'New contact synced' },
  contact_tag_added:{ label: 'Tag Applied',        color: 'var(--accent-rose)',     desc: 'Tag added to a contact' },
  message_received: { label: 'Any Message',        color: 'var(--accent-purple)',   desc: 'Any incoming message' },
  webhook_received: { label: 'Webhook',            color: '#f59e0b',                desc: 'External HTTP POST' },
  manual:           { label: 'Manual',             color: 'var(--text-muted)',      desc: 'Triggered by user or API' },
}

const TRIGGER_TYPES = Object.keys(TRIGGER_META)

// ─── Step meta ────────────────────────────────────────────────
const STEP_META = {
  send_message:   { label: 'Send Message',    icon: MessageSquare, color: 'var(--accent-primary)' },
  send_image:     { label: 'Send Image',      icon: Image,         color: 'var(--accent-blue)' },
  add_tag:        { label: 'Add Tag',         icon: Tag,           color: 'var(--accent-amber)' },
  remove_tag:     { label: 'Remove Tag',      icon: Tag,           color: 'var(--accent-rose)' },
  react_message:  { label: 'React to Message',icon: Smile,         color: '#f59e0b' },
  delay:          { label: 'Delay / Wait',    icon: Clock,         color: 'var(--accent-amber)' },
  condition:      { label: 'If / Else',       icon: Sliders,       color: 'var(--accent-rose)' },
  update_contact: { label: 'Update Contact',  icon: User,          color: 'var(--accent-indigo)' },
  webhook:        { label: 'Call Webhook',    icon: Globe,         color: 'var(--accent-purple)' },
  log:            { label: 'Log Activity',    icon: FileText,      color: 'var(--text-secondary)' },
}

const STEP_TYPES = Object.keys(STEP_META)

// ─── Cron helpers ─────────────────────────────────────────────
const parseCron = (cronStr) => {
  if (!cronStr) return { type: 'minutes', value: 5, time: '12:00' }
  const parts = cronStr.trim().split(/\s+/)
  if (parts.length === 6 && parts[0].startsWith('*/')) return { type: 'seconds', value: parseInt(parts[0].replace('*/', ''), 10) || 10, time: '12:00' }
  if (parts.length === 5 && parts[0].startsWith('*/')) return { type: 'minutes', value: parseInt(parts[0].replace('*/', ''), 10) || 5, time: '12:00' }
  if (parts.length === 5 && parts[0] === '0' && parts[1].startsWith('*/')) return { type: 'hours', value: parseInt(parts[1].replace('*/', ''), 10) || 1, time: '12:00' }
  if (parts.length === 5 && !parts[0].includes('*') && !parts[1].includes('*') && parts[2] === '*') {
    const m = parts[0].padStart(2, '0'), h = parts[1].padStart(2, '0')
    return { type: 'daily', value: 1, time: `${h}:${m}` }
  }
  return { type: 'custom', value: 5, time: '12:00' }
}

// ─── Step Node ────────────────────────────────────────────────
function StepNode({ step, index, totalSteps, onUpdate, onDelete, onMoveUp, onMoveDown, triggerType }) {
  const [open, setOpen] = useState(false)
  let config = {}
  try { config = typeof step.config === 'string' ? JSON.parse(step.config || '{}') : (step.config || {}) } catch { config = {} }
  const set = (k, v) => onUpdate({ ...step, config: { ...config, [k]: v } })

  const meta = STEP_META[step.step_type] || STEP_META.log
  const Icon = meta.icon

  const summary = (() => {
    if (step.step_type === 'send_message') return config.message ? `"${config.message.slice(0, 40)}..."` : 'Configure message'
    if (step.step_type === 'send_image') return config.image_url ? config.image_url.slice(0, 45) : 'Set image URL'
    if (step.step_type === 'add_tag') return config.tag ? `Add tag: ${config.tag}` : 'Set tag name'
    if (step.step_type === 'remove_tag') return config.tag ? `Remove tag: ${config.tag}` : 'Set tag name'
    if (step.step_type === 'react_message') return `React with ${config.emoji || '👍'}`
    if (step.step_type === 'delay') return config.seconds ? `Wait ${config.seconds}s` : 'Set duration'
    if (step.step_type === 'condition') return config.field ? `If ${config.field} ${config.operator || 'equals'} "${config.value || ''}"` : 'Set condition'
    if (step.step_type === 'update_contact') return 'Update contact fields'
    if (step.step_type === 'webhook') return config.url ? `${config.method || 'POST'} ${config.url.slice(0, 35)}` : 'Configure webhook'
    if (step.step_type === 'log') return config.message || 'Log message'
    return ''
  })()

  const isScheduled = triggerType === 'schedule' || triggerType === 'manual'

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${open ? meta.color : 'var(--border-primary)'}`,
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 'var(--radius-md)',
      width: '100%',
      transition: 'border-color 0.2s',
      overflow: 'hidden',
    }}>
      {/* Header — always visible */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', borderBottom: open ? '1px solid var(--border-primary)' : 'none', background: open ? `${meta.color}06` : 'transparent' }}
        onClick={() => setOpen(!open)}
      >
        {/* Step number badge */}
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: meta.color, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 800 }}>
          {index + 1}
        </div>
        {/* Icon + labels */}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${meta.color}20`, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary || 'Click to configure'}</div>
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {index > 0 && <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={onMoveUp} title="Move up"><ChevronUp size={12} /></button>}
          {index < totalSteps - 1 && <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={onMoveDown} title="Move down"><ChevronDown size={12} /></button>}
          <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={onDelete} title="Delete step"><Trash2 size={12} /></button>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-tertiary)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 12 }}>Action Type</label>
            <select className="form-input form-select" style={{ height: 36, fontSize: 13 }} value={step.step_type} onChange={e => {
              const t = e.target.value
              const defaults = {
                send_message: { message: '' },
                send_image: { image_url: '', caption: '' },
                add_tag: { tag: '' },
                remove_tag: { tag: '' },
                react_message: { emoji: '👍' },
                delay: { seconds: 5 },
                condition: { field: 'name', operator: 'equals', value: '' },
                update_contact: { name: '', email: '' },
                webhook: { url: '', method: 'POST', body: {} },
                log: { message: '' },
              }
              onUpdate({ ...step, step_type: t, config: defaults[t] || {} })
            }}>
              {STEP_TYPES.map(t => <option key={t} value={t}>{STEP_META[t].label}</option>)}
            </select>
          </div>

          {step.step_type === 'send_message' && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 0 }}>Message *</label>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(config.message || '').length} chars</span>
                </div>
                <textarea
                  className="form-input"
                  style={{ minHeight: 100, fontSize: 14, padding: '10px 12px', lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }}
                  value={config.message || ''}
                  onChange={e => set('message', e.target.value)}
                  placeholder="Type your WhatsApp message here..."
                />
                {/* Variable quick-insert */}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Insert:</span>
                  {['{{name}}', '{{phone}}'].map(v => (
                    <button key={v} type="button"
                      onClick={() => set('message', (config.message || '') + v)}
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--accent-primary)', cursor: 'pointer', fontFamily: 'monospace' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Recipient</label>
                <select className="form-input" style={{ height: 36, fontSize: 13 }}
                  value={config.target_type === 'group' ? 'group' : (config.phone ? 'custom' : 'active')}
                  onChange={e => {
                    const m = e.target.value
                    if (m === 'group') onUpdate({ ...step, config: { ...config, target_type: 'group', target_tag: 'all', stagger_seconds: 5, phone: '' } })
                    else if (m === 'custom') onUpdate({ ...step, config: { ...config, target_type: 'single', phone: config.phone || '' } })
                    else onUpdate({ ...step, config: { ...config, target_type: 'single', phone: '' } })
                  }}>
                  {!isScheduled && <option value="active">Active Contact (dynamic)</option>}
                  <option value="custom">Custom Number (static)</option>
                  <option value="group">Group / Tag (broadcast)</option>
                </select>
              </div>
              {config.target_type === 'group' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Target Tag</label>
                    <select className="form-input" style={{ height: 36, fontSize: 13 }} value={config.target_tag || 'all'} onChange={e => set('target_tag', e.target.value)}>
                      <option value="all">All Contacts</option>
                      <option value="whatsapp_groups">All WA Groups</option>
                      <option value="leads">leads</option>
                      <option value="customers">customers</option>
                      <option value="vip">vip</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Stagger (s)</label>
                    <input type="number" className="form-input" style={{ height: 36, fontSize: 13 }} min="0" value={config.stagger_seconds || 5} onChange={e => set('stagger_seconds', parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              )}
              {config.target_type !== 'group' && config.phone !== undefined && config.phone !== '' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Phone Number</label>
                  <input type="text" className="form-input" style={{ height: 36, fontSize: 13 }} value={config.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+91xxxxxxxxxx" />
                </div>
              )}
            </>
          )}

          {step.step_type === 'send_image' && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Image URL *</label>
                <input type="url" className="form-input" style={{ height: 36, fontSize: 13 }} value={config.image_url || ''} onChange={e => set('image_url', e.target.value)} placeholder="https://example.com/image.jpg" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Caption</label>
                <input type="text" className="form-input" style={{ height: 36, fontSize: 13 }} value={config.caption || ''} onChange={e => set('caption', e.target.value)} placeholder="Optional caption text" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Phone Number</label>
                <input type="text" className="form-input" style={{ height: 36, fontSize: 13 }} value={config.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+91xxxxxxxxxx (leave blank = active contact)" />
              </div>
            </>
          )}

          {(step.step_type === 'add_tag' || step.step_type === 'remove_tag') && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Tag Name *</label>
              <input type="text" className="form-input" style={{ height: 36, fontSize: 13 }} value={config.tag || ''} onChange={e => set('tag', e.target.value)} placeholder="e.g. vip, lead, customer" />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>Applied to the contact who triggered this automation</span>
            </div>
          )}

          {step.step_type === 'react_message' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Reaction Emoji *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {['👍', '❤️', '😂', '😮', '😢', '🙏', '✅', '🔥', '👏', '💯'].map(e => (
                  <button key={e} type="button"
                    onClick={() => set('emoji', e)}
                    style={{ fontSize: 20, background: config.emoji === e ? 'var(--bg-secondary)' : 'transparent', border: `2px solid ${config.emoji === e ? 'var(--accent-primary)' : 'var(--border-primary)'}`, borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step.step_type === 'delay' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Delay (seconds) *</label>
              <input type="number" className="form-input" style={{ height: 36, fontSize: 13 }} min="1" value={config.seconds || 5} onChange={e => set('seconds', parseInt(e.target.value) || 1)} />
            </div>
          )}

          {step.step_type === 'condition' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { k: 'field', label: 'Field', opts: [['name','Contact Name'],['phone','Phone'],['email','Email'],['content','Message Content'],['tags','Tags']] },
                { k: 'operator', label: 'Operator', opts: [['equals','Equals'],['not_equals','Not Equals'],['contains','Contains'],['starts_with','Starts With'],['ends_with','Ends With']] },
              ].map(({ k, label, opts }) => (
                <div key={k} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>{label}</label>
                  <select className="form-input form-select" style={{ height: 36, fontSize: 13 }} value={config[k] || opts[0][0]} onChange={e => set(k, e.target.value)}>
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Value</label>
                <input type="text" className="form-input" style={{ height: 36, fontSize: 13 }} value={config.value || ''} onChange={e => set('value', e.target.value)} placeholder="e.g. Sales" />
              </div>
            </div>
          )}

          {step.step_type === 'update_contact' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['name','Name'],['email','Email']].map(([k, l]) => (
                <div key={k} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>{l}</label>
                  <input type="text" className="form-input" style={{ height: 36, fontSize: 13 }} value={config[k] || ''} onChange={e => set(k, e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {step.step_type === 'webhook' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Method</label>
                  <select className="form-input form-select" style={{ height: 36, fontSize: 13 }} value={config.method || 'POST'} onChange={e => set('method', e.target.value)}>
                    {['POST','GET','PUT','PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>URL *</label>
                  <input type="url" className="form-input" style={{ height: 36, fontSize: 13 }} value={config.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://hooks.example.com/..." />
                </div>
              </div>
            </>
          )}

          {step.step_type === 'log' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Log Message *</label>
              <input type="text" className="form-input" style={{ height: 36, fontSize: 13 }} value={config.message || ''} onChange={e => set('message', e.target.value)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Flow connector ───────────────────────────────────────────
function Connector({ onInsert }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 28, position: 'relative', width: '100%' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ width: 2, height: '100%', background: hov ? 'var(--accent-primary)' : 'var(--border-primary)', transition: 'background 0.15s' }} />
      <div style={{ position: 'absolute', bottom: 0, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `6px solid ${hov ? 'var(--accent-primary)' : 'var(--text-muted)'}` }} />
      {onInsert && (
        <button type="button" onClick={onInsert}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-tertiary)', border: `1px solid ${hov ? 'var(--accent-primary)' : 'var(--border-primary)'}`, color: hov ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <Plus size={10} />
        </button>
      )}
    </div>
  )
}

// ─── Automation Modal ─────────────────────────────────────────
function AutomationModal({ automation, onClose, onSave }) {
  const [form, setForm] = useState({ name: automation?.name || '', description: automation?.description || '', trigger_type: automation?.trigger_type || 'manual', cooldown_minutes: automation?.cooldown_minutes ?? 0 })
  const [triggerKeyword, setTriggerKeyword] = useState(automation?.trigger_config?.keyword || '')
  const [triggerPattern, setTriggerPattern] = useState(automation?.trigger_config?.pattern || '')
  const [patternMode, setPatternMode] = useState(automation?.trigger_config?.match_mode || 'contains')
  const [triggerTag, setTriggerTag] = useState(automation?.trigger_config?.tag || '')
  const [triggerCron, setTriggerCron] = useState(automation?.trigger_config?.cron || '')
  const [scheduleBuilder, setScheduleBuilder] = useState(() => parseCron(automation?.trigger_config?.cron || ''))
  const [steps, setSteps] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (automation?.id) {
      automationsApi.getSteps(automation.id)
        .then(res => setSteps(res.data || []))
        .catch(() => setError('Failed to load steps.'))
    } else {
      setSteps([])
    }
  }, [automation])

  useEffect(() => {
    if (form.trigger_type !== 'schedule') return
    const { type, value, time } = scheduleBuilder
    if (type === 'custom') return
    if (type === 'seconds') setTriggerCron(`*/${value} * * * * *`)
    else if (type === 'minutes') setTriggerCron(`*/${value} * * * *`)
    else if (type === 'hours') setTriggerCron(`0 */${value} * * *`)
    else if (type === 'daily') {
      const [h, m] = time.split(':').map(Number)
      setTriggerCron(`${m} ${h} * * *`)
    }
  }, [scheduleBuilder, form.trigger_type])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    try {
      let trigger_config = {}
      if (form.trigger_type === 'keyword') {
        if (!triggerKeyword.trim()) { setError('Keyword is required.'); setSaving(false); return }
        trigger_config = { keyword: triggerKeyword.trim() }
      } else if (form.trigger_type === 'keyword_pattern') {
        if (!triggerPattern.trim()) { setError('Pattern is required.'); setSaving(false); return }
        trigger_config = { pattern: triggerPattern.trim(), match_mode: patternMode }
      } else if (form.trigger_type === 'schedule') {
        if (!triggerCron.trim()) { setError('Schedule is required.'); setSaving(false); return }
        trigger_config = { cron: triggerCron.trim() }
      } else if (form.trigger_type === 'contact_tag_added') {
        trigger_config = { tag: triggerTag.trim() }
      }

      const parsedSteps = steps.map((s, i) => {
        let cfg = typeof s.config === 'string' ? JSON.parse(s.config || '{}') : (s.config || {})
        const { id, automation_id, created_at, updated_at, ...clean } = s
        return { ...clean, step_order: i + 1, config: cfg }
      })

      const payload = { ...form, trigger_config, cooldown_minutes: form.cooldown_minutes || 0, steps: parsedSteps }
      if (automation?.id) { await automationsApi.update(automation.id, payload) }
      else { await automationsApi.create(payload) }
      onSave()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally { setSaving(false) }
  }

  const addStep = () => setSteps([...steps, { step_type: 'send_message', step_order: steps.length + 1, config: {} }])
  const insertAt = (i) => {
    const s = [...steps]; s.splice(i, 0, { step_type: 'send_message', step_order: i + 1, config: {} })
    setSteps(s.map((x, idx) => ({ ...x, step_order: idx + 1 })))
  }
  const move = (i, dir) => {
    const s = [...steps]; const j = i + dir; [s[i], s[j]] = [s[j], s[i]]; setSteps(s)
  }

  const tt = form.trigger_type
  const triggerMeta = TRIGGER_META[tt] || TRIGGER_META.manual

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 className="modal-title">{automation ? 'Edit Automation' : 'New Automation'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSave}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--accent-rose)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" placeholder="e.g. Welcome Message" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Trigger</label>
              <select className="form-input form-select" value={tt} onChange={e => setForm({ ...form, trigger_type: e.target.value })}>
                {TRIGGER_TYPES.map(t => <option key={t} value={t}>{TRIGGER_META[t].label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="What does this automation do?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Timer size={12} /> Cooldown (minutes)
              </label>
              <input type="number" className="form-input" min="0" placeholder="0 = no cooldown"
                value={form.cooldown_minutes} onChange={e => setForm({ ...form, cooldown_minutes: parseInt(e.target.value) || 0 })} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                {form.cooldown_minutes > 0 ? `Won't re-trigger within ${form.cooldown_minutes} min of last run` : 'No cooldown — triggers every time'}
              </span>
            </div>
          </div>

          {/* Trigger config */}
          <div style={{ background: `${triggerMeta.color}11`, border: `1px solid ${triggerMeta.color}33`, borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: triggerMeta.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              {triggerMeta.label} — {triggerMeta.desc}
            </div>

            {tt === 'keyword' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Exact Keyword *</label>
                <input className="form-input" style={{ height: 36, fontSize: 13 }} placeholder="e.g. hello" value={triggerKeyword} onChange={e => setTriggerKeyword(e.target.value)} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Triggers when incoming message exactly matches this word (case-insensitive).</span>
              </div>
            )}

            {tt === 'keyword_pattern' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Match Mode</label>
                    <select className="form-input form-select" style={{ height: 36, fontSize: 13 }} value={patternMode} onChange={e => setPatternMode(e.target.value)}>
                      <option value="contains">Contains</option>
                      <option value="starts_with">Starts With</option>
                      <option value="ends_with">Ends With</option>
                      <option value="regex">Regex</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Pattern *</label>
                    <input className="form-input" style={{ height: 36, fontSize: 13 }} placeholder={patternMode === 'regex' ? '^order\\s+\\d+' : 'e.g. order'} value={triggerPattern} onChange={e => setTriggerPattern(e.target.value)} />
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>Triggers when an incoming message matches the pattern (case-insensitive).</span>
              </>
            )}

            {tt === 'schedule' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['seconds','Seconds'],['minutes','Minutes'],['hours','Hours'],['daily','Daily'],['custom','Custom Cron']].map(([id, lbl]) => (
                    <button key={id} type="button" onClick={() => setScheduleBuilder(p => ({ ...p, type: id }))}
                      style={{ padding: '5px 12px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, border: '1px solid var(--border-primary)', cursor: 'pointer', background: scheduleBuilder.type === id ? 'var(--accent-primary-muted)' : 'rgba(255,255,255,0.02)', color: scheduleBuilder.type === id ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {scheduleBuilder.type !== 'custom' && scheduleBuilder.type !== 'daily' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Every (value)</label>
                    <input type="number" className="form-input" style={{ height: 36, fontSize: 13 }} min="1" value={scheduleBuilder.value}
                      onChange={e => setScheduleBuilder(p => ({ ...p, value: Math.max(1, parseInt(e.target.value, 10) || 1) }))} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Runs every {scheduleBuilder.value} {scheduleBuilder.type}</span>
                  </div>
                )}
                {scheduleBuilder.type === 'daily' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Time of Day</label>
                    <input type="time" className="form-input" style={{ height: 36, fontSize: 13 }} value={scheduleBuilder.time}
                      onChange={e => setScheduleBuilder(p => ({ ...p, time: e.target.value || '12:00' }))} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Runs every day at {scheduleBuilder.time}</span>
                  </div>
                )}
                {scheduleBuilder.type === 'custom' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Cron Expression</label>
                    <input className="form-input" style={{ height: 36, fontSize: 13 }} placeholder="*/5 * * * *" value={triggerCron} onChange={e => setTriggerCron(e.target.value)} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Standard 5-field crontab format</span>
                  </div>
                )}
              </div>
            )}

            {tt === 'contact_tag_added' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Tag (optional — blank = any tag)</label>
                <input className="form-input" style={{ height: 36, fontSize: 13 }} placeholder="e.g. vip" value={triggerTag} onChange={e => setTriggerTag(e.target.value)} />
              </div>
            )}

            {tt === 'webhook_received' && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                External systems can trigger this automation by sending a <strong>POST</strong> request to:<br />
                <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                  POST /api/v1/automations/{automation?.id || '{id}'}/webhook-trigger
                </code><br />
                Save the automation first to get the ID.
              </div>
            )}

            {(tt === 'contact_added' || tt === 'message_received' || tt === 'manual') && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{triggerMeta.desc} — no additional configuration required.</div>
            )}
          </div>

          {/* Workflow canvas */}
          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Workflow Steps</span>
                {steps.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{steps.length} step{steps.length !== 1 ? 's' : ''} — click a step to configure</span>}
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={addStep}><Plus size={13} /> Add Step</button>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, maxHeight: 520, overflowY: 'auto' }}>
              {/* Trigger node */}
              <div style={{ background: `${triggerMeta.color}18`, border: `1px dashed ${triggerMeta.color}`, borderRadius: 'var(--radius-md)', padding: '10px 14px', width: '100%', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: triggerMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={13} color="#000" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Trigger: {triggerMeta.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {tt === 'keyword' && triggerKeyword ? `Keyword: "${triggerKeyword}"` : tt === 'keyword_pattern' && triggerPattern ? `${patternMode}: "${triggerPattern}"` : tt === 'schedule' && triggerCron ? triggerCron : triggerMeta.desc}
                  </div>
                </div>
              </div>

              {steps.length > 0 && <Connector onInsert={() => insertAt(0)} />}

              {steps.map((step, i) => (
                <div key={i} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <StepNode step={step} index={i} totalSteps={steps.length} triggerType={tt}
                    onUpdate={u => setSteps(steps.map((s, idx) => idx === i ? u : s))}
                    onDelete={() => setSteps(steps.filter((_, idx) => idx !== i))}
                    onMoveUp={() => move(i, -1)}
                    onMoveDown={() => move(i, 1)}
                  />
                  <Connector onInsert={() => insertAt(i + 1)} />
                </div>
              ))}

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '7px 12px', width: '100%', textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>End of Workflow</span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : <><Check size={14} /> Save Automation</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Automation Card ──────────────────────────────────────────
function AutomationCard({ automation, onEdit, onDelete, onToggle, onRun, onDuplicate }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const meta = TRIGGER_META[automation.trigger_type] || TRIGGER_META.manual

  const stepIcons = (() => {
    const count = automation.step_count || 0
    return count
  })()

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${automation.is_active ? `${meta.color}33` : 'var(--border-primary)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: automation.is_active ? `0 0 0 1px ${meta.color}11` : 'none',
      position: 'relative',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Trigger icon */}
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <Zap size={16} color={meta.color} />
        </div>

        {/* Name + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{automation.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {automation.description || meta.desc}
          </div>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={() => onToggle(automation)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: automation.is_active ? meta.color : 'var(--text-muted)', flexShrink: 0 }}
          title={automation.is_active ? 'Pause automation' : 'Activate automation'}
        >
          {automation.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
        </button>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}33`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
          {meta.label}
        </span>
        <span className="badge badge-gray">{stepIcons} step{stepIcons !== 1 ? 's' : ''}</span>
        {automation.run_count > 0 && (
          <span className="badge badge-gray">{automation.run_count} run{automation.run_count !== 1 ? 's' : ''}</span>
        )}
        {automation.cooldown_minutes > 0 && (
          <span className="badge badge-gray" title="Cooldown"><Timer size={9} style={{ marginRight: 2 }} />{automation.cooldown_minutes}m</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {automation.last_run ? formatIST(automation.last_run) : 'Never run'}
        </span>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border-primary)', paddingTop: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onRun(automation.id)} title="Run now">
          <Play size={13} /> Run
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onTestRun(automation.id)} title="Dry run — simulate without sending">
          <FlaskConical size={13} /> Test
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onHistory(automation)} title="Run history">
          <History size={13} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(automation)}>
          <Edit2 size={13} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onDuplicate(automation.id)} title="Duplicate">
          <Copy size={13} />
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(automation.id)} style={{ marginLeft: 'auto' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Templates Modal ──────────────────────────────────────────
function TemplatesModal({ onClose, onInstall }) {
  const [installing, setInstalling] = useState(null)

  const install = async (tpl) => {
    setInstalling(tpl.id)
    try {
      const { id: _id, emoji: _e, ...payload } = tpl
      await automationsApi.create(payload)
      onInstall()
    } catch { } finally { setInstalling(null) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700, maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 className="modal-title"><BookOpen size={16} style={{ marginRight: 6 }} />Templates Library</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Install a pre-built automation with one click. You can edit it after installing.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {TEMPLATES.map(tpl => (
            <div key={tpl.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 26, lineHeight: 1 }}>{tpl.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{tpl.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{tpl.description}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ background: `${TRIGGER_META[tpl.trigger_type]?.color || 'var(--accent-primary)'}18`, color: TRIGGER_META[tpl.trigger_type]?.color || 'var(--accent-primary)', border: `1px solid ${TRIGGER_META[tpl.trigger_type]?.color || 'var(--accent-primary)'}33`, borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>
                  {TRIGGER_META[tpl.trigger_type]?.label || tpl.trigger_type}
                </span>
                <span className="badge badge-gray">{tpl.steps.length} steps</span>
                {tpl.cooldown_minutes > 0 && <span className="badge badge-gray">{tpl.cooldown_minutes}m cooldown</span>}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => install(tpl)}
                disabled={installing === tpl.id}
                style={{ width: '100%' }}
              >
                {installing === tpl.id ? 'Installing...' : <><Check size={13} /> Install</>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── History Modal ────────────────────────────────────────────
function HistoryModal({ automation, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    automationsApi.getHistory(automation.id, 30)
      .then(res => setLogs(res.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [automation.id])

  const statusColor = { success: 'var(--accent-primary)', failed: 'var(--accent-rose)', running: 'var(--accent-amber)', partial: 'var(--accent-amber)' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title"><History size={15} style={{ marginRight: 6 }} />Run History</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{automation.name}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No runs yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map(log => (
              <div key={log.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[log.status] || 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{log.status}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.started_at ? formatIST(log.started_at) : '—'}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                    <div>{log.steps_executed}/{log.total_steps} steps</div>
                    {log.execution_time && <div>{log.execution_time.toFixed(0)}ms</div>}
                  </div>
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: expanded === log.id ? 'rotate(180deg)' : '', transition: 'transform 0.15s' }} />
                </div>
                {expanded === log.id && (
                  <div style={{ borderTop: '1px solid var(--border-primary)', padding: '10px 14px' }}>
                    {log.error_message && (
                      <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontSize: 12, color: 'var(--accent-rose)' }}>
                        {log.error_message}
                      </div>
                    )}
                    {log.log_output && (
                      <pre style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, lineHeight: 1.7 }}>
                        {log.log_output}
                      </pre>
                    )}
                    {log.trigger_data && Object.keys(log.trigger_data).length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        Triggered by: {log.trigger_data.phone || log.trigger_data.trigger || 'unknown'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dry Run Result Modal ─────────────────────────────────────
function DryRunModal({ result, name, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3 className="modal-title"><FlaskConical size={15} style={{ marginRight: 6 }} />Dry Run Result — {name}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--accent-primary)' }}>
          ✅ Simulation complete — {result.steps_simulated} step{result.steps_simulated !== 1 ? 's' : ''} simulated. No real messages were sent.
        </div>
        {result.log_output && (
          <pre style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 12, margin: 0, lineHeight: 1.8 }}>
            {result.log_output}
          </pre>
        )}
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function Automations() {
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [historyItem, setHistoryItem] = useState(null)
  const [dryRunResult, setDryRunResult] = useState(null)
  const [dryRunName, setDryRunName] = useState('')
  const [runMsg, setRunMsg] = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await automationsApi.getAll({ search })
      setAutomations(res.data?.automations || res.data || [])
    } catch { setAutomations([]) } finally { setLoading(false) }
  }, [search])

  useEffect(() => { const t = setTimeout(fetch, 300); return () => clearTimeout(t) }, [fetch])

  const toggleStatus = async (a) => {
    try {
      if (a.is_active) { await automationsApi.deactivate(a.id) }
      else { await automationsApi.activate(a.id) }
      fetch()
    } catch { }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this automation?')) return
    try { await automationsApi.delete(id); fetch() } catch { }
  }

  const handleRun = async (id) => {
    try {
      await automationsApi.run(id)
      setRunMsg('Automation triggered!')
      setTimeout(() => setRunMsg(''), 3000)
    } catch { }
  }

  const handleTestRun = async (id) => {
    const auto = automations.find(a => a.id === id)
    try {
      const res = await automationsApi.dryRun(id)
      setDryRunName(auto?.name || '')
      setDryRunResult(res.data)
    } catch { }
  }

  const handleDuplicate = async (id) => {
    try {
      await automationsApi.duplicate(id)
      setRunMsg('Automation duplicated!')
      setTimeout(() => setRunMsg(''), 3000)
      fetch()
    } catch { }
  }

  const totalActive = automations.filter(a => a.is_active).length
  const totalRuns = automations.reduce((s, a) => s + (a.run_count || 0), 0)

  const filtered = automations.filter(a => {
    if (filterActive === 'active') return a.is_active
    if (filterActive === 'inactive') return !a.is_active
    return true
  })

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Automations</h2>
          <p className="page-subtitle">Build and manage your WhatsApp workflows</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowTemplates(true)}>
            <BookOpen size={15} /> Templates
          </button>
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowModal(true) }}>
            <Plus size={15} /> New Automation
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: automations.length, color: 'var(--text-primary)' },
          { label: 'Active', value: totalActive, color: 'var(--accent-primary)' },
          { label: 'Total Runs', value: totalRuns, color: 'var(--accent-indigo)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Run message toast */}
      {runMsg && (
        <div style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--accent-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <CheckCircle size={14} /> {runMsg}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} className="search-bar-icon" />
          <input className="form-input" placeholder="Search automations..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all','All'],['active','Active'],['inactive','Inactive']].map(([v, l]) => (
            <button key={v} type="button"
              onClick={() => setFilterActive(v)}
              className={filterActive === v ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Zap size={28} /></div>
          <div className="empty-state-title">{search ? 'No automations found' : 'No automations yet'}</div>
          <div className="empty-state-desc">Create your first WhatsApp automation workflow</div>
          {!search && <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowModal(true) }}><Plus size={15} /> Create Automation</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(a => (
            <AutomationCard key={a.id} automation={a}
              onEdit={item => { setEditItem(item); setShowModal(true) }}
              onDelete={handleDelete}
              onToggle={toggleStatus}
              onRun={handleRun}
              onTestRun={handleTestRun}
              onHistory={item => setHistoryItem(item)}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AutomationModal
          automation={editItem}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetch() }}
        />
      )}
      {showTemplates && (
        <TemplatesModal
          onClose={() => setShowTemplates(false)}
          onInstall={() => { setShowTemplates(false); fetch(); setRunMsg('Template installed!'); setTimeout(() => setRunMsg(''), 3000) }}
        />
      )}
      {historyItem && (
        <HistoryModal automation={historyItem} onClose={() => setHistoryItem(null)} />
      )}
      {dryRunResult && (
        <DryRunModal result={dryRunResult} name={dryRunName} onClose={() => setDryRunResult(null)} />
      )}
    </div>
  )
}
