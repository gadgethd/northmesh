import { Link, useLocation, Outlet } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import styles from './Layout.module.css'

export default function Layout() {
  const location = useLocation()
  const { isConnected } = useWebSocket()

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/map', label: 'Live Map' },
    { path: '/network', label: 'Network' },
  ]

  return (
    <div className={styles.layout}>
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="4" fill="url(#aurora-grad)"/>
              <circle cx="16" cy="16" r="7" stroke="url(#aurora-grad)" strokeWidth="1" opacity="0.6"/>
              <circle cx="16" cy="16" r="11" stroke="url(#aurora-grad)" strokeWidth="0.5" opacity="0.3"/>
              <circle cx="16" cy="16" r="14" stroke="url(#aurora-grad)" strokeWidth="0.5" opacity="0.15"/>
              <defs>
                <linearGradient id="aurora-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00e5cc"/>
                  <stop offset="50%" stopColor="#00d4ff"/>
                  <stop offset="100%" stopColor="#34f5a0"/>
                </linearGradient>
              </defs>
            </svg>
            <span>NorthMesh</span>
          </Link>

          <div className={styles.navLinks}>
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`${styles.navLink} ${location.pathname === link.path ? styles.active : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className={styles.statusIndicator}>
            <span className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`} />
            <span className={styles.statusText}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p>NorthMesh — Connecting the North, One Node at a Time</p>
          <p className={styles.footerMuted}>
            Powered by MeshCore • Cloudflare Tunnel
          </p>
        </div>
      </footer>
    </div>
  )
}
