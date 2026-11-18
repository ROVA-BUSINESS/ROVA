import { useState, useMemo } from 'react';
import {
  Search,
  ExternalLink,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface BankingPortal {
  name: string;
  category: 'commercial' | 'digital';
  portalUrl: string;
  tagline: string;
  color: string;
  logo: string;
  rovaConnected?: boolean;
}

const BANKING_PORTALS: BankingPortal[] = [
  // Commercial Banks
  {
    name: 'Guaranty Trust Bank (GTBank)',
    category: 'commercial',
    portalUrl: 'https://www.gtbank.com/',
    tagline: 'GTWorld & GTCash Online Banking',
    color: '#e4572e',
    logo: '/banks/gtbank.png',
  },
  {
    name: 'Zenith Bank',
    category: 'commercial',
    portalUrl: 'https://ibank.zenithbank.com/InternetBanking/',
    tagline: 'Zenith Corporate & Personal Internet Banking',
    color: '#a61c1c',
    logo: '/banks/zenith.png',
  },
  {
    name: 'Access Bank',
    category: 'commercial',
    portalUrl: 'https://ibank.accessbankplc.com',
    tagline: 'AccessOnline Corporate & Retail Banking',
    color: '#ff6200',
    logo: '/banks/access.png',
  },
  {
    name: 'First Bank of Nigeria',
    category: 'commercial',
    portalUrl: 'https://ibank.firstbanknigeria.com',
    tagline: 'FirstOnline & Corporate i-Bank',
    color: '#003366',
    logo: '/banks/firstbank.png',
  },
  {
    name: 'United Bank for Africa (UBA)',
    category: 'commercial',
    portalUrl: 'https://ibank.ubagroup.com',
    tagline: 'UBA Internet Banking & Leo',
    color: '#d41426',
    logo: '/banks/uba.png',
  },
  {
    name: 'Stanbic IBTC Bank',
    category: 'commercial',
    portalUrl: 'https://smebanking.stanbicibtc.com/auth/',
    tagline: 'Stanbic IBTC Business Online & Enterprise Banking',
    color: '#0051a3',
    logo: '/banks/stanbic.png',
  },
  {
    name: 'First City Monument Bank (FCMB)',
    category: 'commercial',
    portalUrl: 'https://ibank.fcmb.com',
    tagline: 'FCMB Online & Business Zone',
    color: '#5b2c6f',
    logo: '/banks/fcmb.png',
  },
  {
    name: 'Fidelity Bank',
    category: 'commercial',
    portalUrl: 'https://online.fidelitybank.ng/',
    tagline: 'Fidelity Online & Fidelity Corporate Banking',
    color: '#008542',
    logo: '/banks/fidelity.png',
  },
  {
    name: 'Union Bank of Nigeria',
    category: 'commercial',
    portalUrl: 'https://ibank.unionbankng.com',
    tagline: 'UnionOnline & UnionEnterprise Banking',
    color: '#0099cc',
    logo: '/banks/union.png',
  },
  {
    name: 'Sterling Bank',
    category: 'commercial',
    portalUrl: 'https://sterling.ng/',
    tagline: 'Sterling Pro & OneBank Portal',
    color: '#c0392b',
    logo: '/banks/sterling.png',
  },
  {
    name: 'Polaris Bank',
    category: 'commercial',
    portalUrl: 'https://elogin.polarisbanklimited.com/',
    tagline: 'Polaris Xperience & Corporate Banking',
    color: '#1a5276',
    logo: '/banks/polaris.png',
  },
  {
    name: 'Wema Bank',
    category: 'commercial',
    portalUrl: 'https://online.alat.ng/',
    tagline: 'ALAT by Wema & Corporate Portal',
    color: '#8e44ad',
    logo: '/banks/wema.png',
  },
  {
    name: 'Providus Bank',
    category: 'commercial',
    portalUrl: 'https://ibank.providusbank.com/provipay/',
    tagline: 'Providus Corporate Internet Banking',
    color: '#1b2631',
    logo: '/banks/providus.png',
  },
  {
    name: 'Keystone Bank',
    category: 'commercial',
    portalUrl: 'https://retailibank.keystonebankng.com/',
    tagline: 'KeyOnline Corporate & Retail',
    color: '#117864',
    logo: '/banks/keystone.png',
  },
  {
    name: 'Unity Bank',
    category: 'commercial',
    portalUrl: 'https://ibank.unitybankng.com',
    tagline: 'Unity Online Business Portal',
    color: '#27ae60',
    logo: '/banks/unity.svg',
  },
  {
    name: 'Ecobank Nigeria',
    category: 'commercial',
    portalUrl: 'https://ecobank.com/ng/personal/digital-banking',
    tagline: 'Omni Lite Corporate Banking',
    color: '#005580',
    logo: '/banks/ecobank.png',
  },
  {
    name: 'Coronation Merchant Bank',
    category: 'commercial',
    portalUrl: 'https://ibanking.coronationmb.com/',
    tagline: 'Coronation Corporate Banking Platform',
    color: '#b7950b',
    logo: '/banks/coronation.png',
  },
  {
    name: 'Standard Chartered Bank',
    category: 'commercial',
    portalUrl: 'https://www.sc.com/ng/online-banking-login/',
    tagline: 'Straight2Bank Corporate & Institutional Gateway',
    color: '#026928',
    logo: '/banks/standardchartered.png',
  },
  {
    name: 'Titan Trust Bank',
    category: 'commercial',
    portalUrl: 'https://www.titantrustbank.com',
    tagline: 'Titan Digital Corporate Banking Portal',
    color: '#900c3f',
    logo: '/banks/titantrust.png',
  },

  // Digital / Neo-Banks
  {
    name: 'Moniepoint Business',
    category: 'digital',
    portalUrl: 'https://atm.moniepoint.com/',
    tagline: 'All-in-One SME Bank, Terminals & Accounts',
    color: '#0033aa',
    logo: '/banks/moniepoint.png',
    rovaConnected: true,
  },
  {
    name: 'Kuda Business',
    category: 'digital',
    portalUrl: 'https://app.kuda.com/',
    tagline: 'Corporate Banking, Invoicing & Accounts by Kuda',
    color: '#40196d',
    logo: '/banks/kuda.png',
    rovaConnected: true,
  },
  {
    name: 'PalmPay Business',
    category: 'digital',
    portalUrl: 'https://business.palmpay.com',
    tagline: 'PalmPay Merchant Services & Agent Portal',
    color: '#00c853',
    logo: '/banks/palmpay.png',
  },
  {
    name: 'VFD (V-Bank)',
    category: 'digital',
    portalUrl: 'https://www.v-bank.com',
    tagline: 'V-Bank Corporate & Digital Banking',
    color: '#e67e22',
    logo: '/banks/vfd.svg',
  },
];

export default function MyBankingTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'commercial' | 'digital' | 'connected'>('all');

  const filteredPortals = useMemo(() => {
    return BANKING_PORTALS.filter((bank) => {
      // Category match
      if (selectedCategory === 'commercial' && bank.category !== 'commercial') return false;
      if (selectedCategory === 'digital' && bank.category !== 'digital') return false;
      if (selectedCategory === 'connected' && !bank.rovaConnected) return false;

      // Search match
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = bank.name.toLowerCase().includes(q);
        const matchesTag = bank.tagline.toLowerCase().includes(q);
        return matchesName || matchesTag;
      }

      return true;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Intro Header & Official Directory Notice */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(124, 58, 237, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              My Banking Directory
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Direct access to official internet banking portals for licensed Nigerian commercial and digital banks.
            </p>
          </div>
        </div>

        {/* Security & Direct Ownership Guarantee */}
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
          }}
        >
          <ShieldCheck size={18} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Your Business Owns Its Bank Account: </strong>
            ROVA does not store, hold, or intermediary your money in a custodial wallet. When accessing your bank, you are securely transferred directly to your bank&apos;s verified encrypted banking portal. All credentials and two-factor tokens remain strictly between you and your bank.
          </div>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {/* Search input */}
        <div
          style={{
            position: 'relative',
            flex: '1 1 280px',
            maxWidth: 420,
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search bank name or service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--bg-border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Banks' },
            { id: 'commercial', label: 'Commercial Banks' },
            { id: 'digital', label: 'Digital / Neo-Banks' },
            { id: 'connected', label: 'Integrated with ROVA' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background:
                  selectedCategory === cat.id
                    ? 'var(--accent-primary)'
                    : 'var(--bg-elevated)',
                color:
                  selectedCategory === cat.id
                    ? '#ffffff'
                    : 'var(--text-secondary)',
                boxShadow:
                  selectedCategory === cat.id
                    ? '0 2px 8px rgba(124, 58, 237, 0.25)'
                    : 'none',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor:
                  selectedCategory === cat.id
                    ? 'var(--accent-primary)'
                    : 'var(--bg-border)',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bank Portals Grid */}
      {filteredPortals.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            padding: 48,
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <Building2 size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px', color: 'var(--text-primary)' }}>
            No banks found
          </h3>
          <p style={{ fontSize: 13, margin: 0 }}>
            No banking portal matched &quot;{searchTerm}&quot;. Try searching for another Nigerian bank.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {filteredPortals.map((bank) => (
            <div
              key={bank.name}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14,
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              {/* Header */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: '#ffffff',
                        border: '1px solid var(--bg-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        padding: 4,
                        flexShrink: 0,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      <img
                        src={bank.logo}
                        alt={`${bank.name} logo`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.style.background = `${bank.color}15`;
                            parent.style.borderColor = `${bank.color}35`;
                            parent.style.color = bank.color;
                            parent.innerHTML = `<span style="font-weight: 800; font-size: 13px;">${bank.name.slice(0, 2).toUpperCase()}</span>`;
                          }
                        }}
                      />
                    </div>
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {bank.name}
                      </h4>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {bank.category === 'commercial' ? 'Commercial Bank' : 'Digital / Microfinance Bank'}
                      </span>
                    </div>
                  </div>

                  {bank.rovaConnected && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: 'rgba(34, 197, 94, 0.12)',
                        color: 'var(--success)',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle2 size={11} />
                      ROVA Sync
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {bank.tagline}
                </p>
              </div>

              {/* Action Button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                  borderTop: '1px solid var(--bg-border)',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 160,
                  }}
                  title={bank.portalUrl}
                >
                  {bank.portalUrl.replace(/^https?:\/\//, '')}
                </div>

                <a
                  href={bank.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-primary)',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                  }}
                >
                  <span>Open Portal</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Directory Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 8,
          padding: '8px 12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--bg-border)',
        }}
      >
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>
          Bank logos, portal trademarks, and service names are property of their respective licensed financial institutions under Central Bank of Nigeria (CBN) regulations.
        </span>
      </div>
    </div>
  );
}

