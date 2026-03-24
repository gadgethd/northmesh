import { Link } from 'react-router-dom'
import { Radio, Activity, Globe, Zap } from 'lucide-react'
import { useNodeStore } from '../hooks/useNodes'
import { useWebSocket } from '../hooks/useWebSocket'
import styles from './HomePage.module.css'

function StatCard({ icon: Icon, value, label }: { icon: React.ElementType; value: number | string; label: string }) {
  return (
    <div className={styles.statCard}>
      <Icon size={24} className={styles.statIcon} />
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

export default function HomePage() {
  useWebSocket()
  const { stats, isConnected } = useNodeStore()

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.auroraBg} />
        <div className={styles.heroContent}>
          <div className={styles.logoLarge}>
            <svg width="80" height="80" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="4" fill="url(#aurora-grad-lg)"/>
              <circle cx="16" cy="16" r="7" stroke="url(#aurora-grad-lg)" strokeWidth="1" opacity="0.6"/>
              <circle cx="16" cy="16" r="11" stroke="url(#aurora-grad-lg)" strokeWidth="0.5" opacity="0.3"/>
              <circle cx="16" cy="16" r="14" stroke="url(#aurora-grad-lg)" strokeWidth="0.5" opacity="0.15"/>
              <defs>
                <linearGradient id="aurora-grad-lg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00e5cc"/>
                  <stop offset="50%" stopColor="#00d4ff"/>
                  <stop offset="100%" stopColor="#34f5a0"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className={styles.title}>NorthMesh</h1>
          <p className={styles.tagline}>Connecting the North, One Node at a Time</p>
          <p className={styles.subtagline}>
            Real-time visualization of the MeshCore network across northern England.
            Track nodes, monitor packet flow, and explore RF coverage.
          </p>
          <div className={styles.heroCta}>
            <Link to="/map" className={styles.btnPrimary}>
              <Globe size={18} />
              View Live Map
            </Link>
            <Link to="/network" className={styles.btnSecondary}>
              <Activity size={18} />
              Network Stats
            </Link>
          </div>
        </div>
        <div className={styles.scrollIndicator}>
          <div className={styles.scrollMouse}>
            <div className={styles.scrollWheel} />
          </div>
        </div>
      </section>

      <section className={styles.statsBar}>
        <div className={styles.statsContent}>
          <StatCard icon={Radio} value={stats.totalNodes} label="Total Nodes" />
          <StatCard icon={Zap} value={stats.onlineNodes} label="Online Now" />
          <StatCard icon={Activity} value={stats.packetsToday.toLocaleString()} label="Packets Today" />
          <StatCard icon={Globe} value={stats.activeLinks} label="Active Links" />
        </div>
        <div className={`${styles.connectionStatus} ${isConnected ? styles.live : ''}`}>
          <span className={styles.statusDot} />
          {isConnected ? 'Live Data' : 'Connecting...'}
        </div>
      </section>

      <section className={styles.about}>
        <div className={styles.aboutContent}>
          <h2 className={styles.sectionTitle}>What is MeshCore?</h2>
          <p className={styles.aboutText}>
            MeshCore is a decentralized mesh networking protocol designed for resilient, 
            community-owned communication infrastructure. Operating on LoRa frequencies 
            (868 MHz), MeshCore nodes form a self-healing network that can operate 
            independently of traditional internet infrastructure.
          </p>
          <p className={styles.aboutText}>
            Each node acts as a router, forwarding packets across the network. 
            Whether you're in the heart of a city or in a remote rural area, 
            MeshCore enables direct device-to-device communication without 
            relying on centralized servers.
          </p>
          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <Radio size={24} />
              </div>
              <h3>Long Range</h3>
              <p>Up to 20km range in rural areas using LoRa modulation</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <Activity size={24} />
              </div>
              <h3>Real-Time Tracking</h3>
              <p>Watch packets flow across the network as they happen</p>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <Globe size={24} />
              </div>
              <h3>Community Owned</h3>
              <p>Decentralized infrastructure run by volunteers</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={styles.ctaContent}>
          <h2>Ready to Explore?</h2>
          <p>Jump into the live map and see the network in action.</p>
          <Link to="/map" className={styles.btnPrimary}>
            <Globe size={18} />
            Open Live Map
          </Link>
        </div>
      </section>
    </div>
  )
}
