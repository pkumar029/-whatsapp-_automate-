import { useState, useEffect, useCallback } from 'react'
import { Zap, Plus, Play, Pause, Trash2, Edit2, Search, X, Check, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { automationsApi } from '../../services/api'
import { formatIST } from '../../utils/date'
import { getErrorMessage } from '../../utils/error'

const TRIGGER_TYPES = ['keyword', 'schedule', 'contact_added', 'message_received', 'manual']
const STEP_TYPES = ['send_message', 'delay', 'condition', 'update_contact', 'webhook', 'log']

// ─── Step Editor ──────────────────────────────────────────────
// ─── Step Editor ──────────────────────────────────────────────
function StepRow({ step, index, onUpdate, onDelete }) {
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

  return (
    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <GripVertical size={14} color="var(--text-muted)" />
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-purple-muted)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{index + 1}</div>
        <select 
          className="form-input" 
          style={{ flex: 1, padding: '6px 10px' }} 
          value={step.step_type} 
          onClick={e => e.stopPropagation()} 
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
        <div style={{ display: 'flex', gap: 4 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <button className="btn btn-danger btn-icon btn-sm" onClick={e => { e.stopPropagation(); onDelete() }}><Trash2 size={12} /></button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {step.step_type === 'send_message' && (
            <div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Message Text *</label>
                <textarea 
                  className="form-input form-textarea" 
                  style={{ minHeight: 60, fontSize: 13 }}
                  value={config.message || ''} 
                  onChange={e => updateConfigField('message', e.target.value)}
                  placeholder="e.g. Hello {{name}}! Welcome to our service."
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Use `{{name}}` or `{{phone}}` to insert contact details dynamically.
                </span>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Recipient Phone Number (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: 13 }}
                  value={config.phone || ''} 
                  onChange={e => updateConfigField('phone', e.target.value)}
                  placeholder="Leave empty to use the active contact's phone"
                />
              </div>
            </div>
          )}

          {step.step_type === 'delay' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Delay Duration (Seconds) *</label>
              <input 
                type="number" 
                className="form-input" 
                style={{ padding: '6px 10px', fontSize: 13 }}
                min="1" 
                value={config.seconds || 1} 
                onChange={e => updateConfigField('seconds', parseInt(e.target.value) || 1)}
                placeholder="e.g. 5"
              />
            </div>
          )}

          {step.step_type === 'condition' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Field to Check *</label>
                <select 
                  className="form-input form-select" 
                  style={{ padding: '6px 10px', fontSize: 13 }}
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
                <label className="form-label" style={{ fontSize: 12 }}>Operator *</label>
                <select 
                  className="form-input form-select" 
                  style={{ padding: '6px 10px', fontSize: 13 }}
                  value={config.operator || 'equals'} 
                  onChange={e => updateConfigField('operator', e.target.value)}
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Does Not Equal</option>
                  <option value="contains">Contains</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Match Value *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: 13 }}
                  value={config.value || ''} 
                  onChange={e => updateConfigField('value', e.target.value)}
                  placeholder="e.g. John"
                />
              </div>
            </div>
          )}

          {step.step_type === 'update_contact' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Update Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: 13 }}
                  value={config.name || ''} 
                  onChange={e => updateConfigField('name', e.target.value)}
                  placeholder="e.g. New Name"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Update Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: 13 }}
                  value={config.email || ''} 
                  onChange={e => updateConfigField('email', e.target.value)}
                  placeholder="e.g. new@example.com"
                />
              </div>
            </div>
          )}

          {step.step_type === 'webhook' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Webhook URL *</label>
              <input 
                type="url" 
                className="form-input" 
                style={{ padding: '6px 10px', fontSize: 13 }}
                value={config.url || ''} 
                onChange={e => updateConfigField('url', e.target.value)}
                placeholder="e.g. https://api.mycrm.com/webhook"
              />
            </div>
          )}

          {step.step_type === 'log' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Log message text *</label>
              <input 
                type="text" 
                className="form-input" 
                style={{ padding: '6px 10px', fontSize: 13 }}
                value={config.message || ''} 
                onChange={e => updateConfigField('message', e.target.value)}
                placeholder="e.g. Delay complete. Continuing workflow..."
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
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
      setTriggerCron(automation.trigger_type === 'schedule' ? automation.trigger_config?.cron || '' : '')
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

  const addStep = () => setSteps([...steps, { step_type: 'send_message', step_order: steps.length + 1, config: {} }])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Automation name is required.'); return }
    setSaving(true); setError('')
    try {
      // Parse trigger_config
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

      // Parse steps config
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
        // Remove DB internal keys that shouldn't be resent/are immutable
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
              <input className="form-input" placeholder="My Automation" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
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
            <div className="form-group">
              <label className="form-label">Cron Schedule Expression *</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. */5 * * * * (every 5 minutes)" 
                value={triggerCron} 
                onChange={e => setTriggerCron(e.target.value)} 
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Standard crontab format: minute, hour, day-of-month, month, day-of-week.
              </span>
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
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Steps ({steps.length})</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addStep}><Plus size={14} /> Add Step</button>
            </div>
            {steps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', border: '2px dashed var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
                No steps yet — click "Add Step" to build your workflow
              </div>
            ) : (
              steps.map((step, i) => (
                <StepRow
                  key={i} step={step} index={i}
                  onUpdate={updated => setSteps(steps.map((s, idx) => idx === i ? updated : s))}
                  onDelete={() => setSteps(steps.filter((_, idx) => idx !== i))}
                />
              ))
            )}
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
