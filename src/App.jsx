import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import BanBanner from './components/BanBanner'
import SideBanners from './components/SideBanners'
import Home from './pages/Home'
import CreateAuction from './pages/CreateAuction'
import AuctionDetail from './pages/AuctionDetail'
import Profile from './pages/Profile'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Planes from './pages/Planes'
import Admin from './pages/Admin'
import Contact from './pages/Contact'

export default function App() {
  return (
    <div className="min-h-screen bg-ink flex flex-col">
      <SideBanners />
      <Navbar />
      <BanBanner />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/publicar" element={<CreateAuction />} />
          <Route path="/subasta/:id" element={<AuctionDetail />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/terminos" element={<Terms />} />
          <Route path="/privacidad" element={<Privacy />} />
          <Route path="/planes" element={<Planes />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/nosotros" element={<Contact />} />
        </Routes>
      </div>
      <Footer />
    </div>
  )
}
