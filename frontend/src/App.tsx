import Header from './components/Header'
import RegisterPanel from './components/RegisterPanel'
import RecognitionPanel from './components/RecognitionPanel'

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f7', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{
        flex: 1,
        display: 'flex',
        gap: 20,
        padding: '24px 24px',
        maxWidth: 1280,
        width: '100%',
        margin: '0 auto',
        alignItems: 'flex-start',
      }}>
        <RegisterPanel />
        <RecognitionPanel />
      </main>
      <footer style={{
        textAlign: 'center', padding: '12px 0',
        fontSize: 11, color: '#94a3b8',
        borderTop: '1px solid #e2e8f0',
        background: '#fff',
      }}>
        AFR Attendance System &nbsp;·&nbsp; Face Recognition powered by InsightFace ArcFace
      </footer>
    </div>
  )
}
