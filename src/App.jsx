import { Route, Routes } from 'react-router-dom'
import { captureReferralCodeFromUrl } from './lib/referrals'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import BanBanner from './components/BanBanner'
import SideBanners from './components/SideBanners'
import ScrollToTopButton from './components/ScrollToTopButton'
import Home from './pages/Home'
import CreateAuction from './pages/CreateAuction'
import AuctionDetail from './pages/AuctionDetail'
import Market from './pages/Market'
import CreateMarketListing from './pages/CreateMarketListing'
import MarketListingDetail from './pages/MarketListingDetail'
import Workbench from './pages/Workbench'
import WorkbenchProductDetail from './pages/WorkbenchProductDetail'
import SearchWishlist from './pages/SearchWishlist'
import Profile from './pages/Profile'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Planes from './pages/Planes'
import Admin from './pages/Admin'
import Contact from './pages/Contact'

// Se ejecuta una sola vez, al cargar el módulo — antes de que AuthContext
// dispare el login, así el referido queda guardado a tiempo (ver lib/referrals.js).
captureReferralCodeFromUrl()

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
          <Route path="/mercado" element={<Market />} />
          <Route path="/mercado/publicar" element={<CreateMarketListing />} />
          <Route path="/mercado/:id" element={<MarketListingDetail />} />
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/workbench/:id" element={<WorkbenchProductDetail />} />
          <Route path="/wishlist" element={<SearchWishlist />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/terminos" element={<Terms />} />
          <Route path="/privacidad" element={<Privacy />} />
          <Route path="/planes" element={<Planes />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/nosotros" element={<Contact />} />
        </Routes>
      </div>
      <Footer />
      <ScrollToTopButton />
    </div>
  )
}
