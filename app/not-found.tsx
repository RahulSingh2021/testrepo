export default function NotFound() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>404</h1>
        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Page not found</p>
      </div>
    </div>
  );
}
