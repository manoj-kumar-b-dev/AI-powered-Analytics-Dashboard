import React from 'react';
import { Building, LayoutGrid, FileText, LogOut } from 'lucide-react';

export const Header = ({
  activeTab,
  setActiveTab,
  user,
  organisations,
  activeOrgId,
  switchOrg,
  logout,
  onSwitchToPremium
}) => {
  return (
    <header className="glass-panel" style={{ margin: '16px', padding: '16px 24px', display: 'flex', justifycontent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, background: 'linear-gradient(to right, #a78bfa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'var(--font-display)' }}>
          Antigravity SaaS
        </h2>

        {/* Org selector dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid hsl(var(--card-border))', padding: '6px 12px', borderRadius: '8px' }}>
          <Building style={{ width: '16px', height: '16px', color: 'hsl(var(--text-muted))' }} />
          <select
            value={activeOrgId || ''}
            onChange={(e) => switchOrg(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
          >
            {organisations.map(org => (
              <option key={org.orgId} value={org.orgId} style={{ background: 'hsl(var(--card))' }}>
                {org.name} ({org.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Switch View Trigger */}
        <button
          onClick={onSwitchToPremium}
          className="btn"
          style={{
            background: 'linear-gradient(to right, #8b5cf6, #3b82f6)',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            fontSize: '0.8rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)'
          }}
        >
          ✨ Premium SaaS UI
        </button>

        {/* Navigation tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setActiveTab('dashboards')}
            className={`btn ${activeTab === 'dashboards' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px' }}
          >
            <LayoutGrid style={{ width: '14px', height: '14px' }} />
            Dashboards
          </button>
          <button
            onClick={() => setActiveTab('datasources')}
            className={`btn ${activeTab === 'datasources' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px' }}
          >
            <FileText style={{ width: '14px', height: '14px' }} />
            Data Sources
          </button>
        </div>

        {/* User profile dropdown stub & logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid hsl(var(--card-border))', paddingLeft: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{user?.name}</div>
            <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>{user?.email}</div>
          </div>
          <button onClick={logout} className="btn btn-secondary" style={{ padding: '8px', borderRadius: '6px' }}>
            <LogOut style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </div>
    </header>
  );
};
