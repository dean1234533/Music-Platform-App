import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { PlayerProvider } from '@/contexts/PlayerContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { ProtectedRoute, RequireOnboarding } from '@/components/auth/ProtectedRoute'
import { RoleRoute } from '@/components/auth/RoleRoute'
import { InstallBanner } from '@/components/pwa/InstallBanner'
import { LoadingState } from '@/components/common/StateViews'

// Every page is route-level code-split: each becomes its own chunk, fetched
// only when actually navigated to, instead of one ~1.2MB bundle everyone
// downloads up front regardless of which of these ~50 pages (many
// role-gated, most people never touching most of them) they'll ever visit.
const LandingPage = lazy(() => import('@/pages/marketing/LandingPage').then((m) => ({ default: m.LandingPage })))
const PricingPage = lazy(() => import('@/pages/marketing/PricingPage').then((m) => ({ default: m.PricingPage })))
const ForDjsPage = lazy(() => import('@/pages/marketing/ForDjsPage').then((m) => ({ default: m.ForDjsPage })))
const ForArtistsPage = lazy(() => import('@/pages/marketing/ForArtistsPage').then((m) => ({ default: m.ForArtistsPage })))
const BlogIndexPage = lazy(() => import('@/pages/blog/BlogIndexPage').then((m) => ({ default: m.BlogIndexPage })))
const BlogPostPage = lazy(() => import('@/pages/blog/BlogPostPage').then((m) => ({ default: m.BlogPostPage })))
const LegalPage = lazy(() => import('@/pages/marketing/LegalPage').then((m) => ({ default: m.LegalPage })))
const CopyrightPolicyPage = lazy(() => import('@/pages/legal/CopyrightPolicyPage').then((m) => ({ default: m.CopyrightPolicyPage })))
const CopyrightClaimPage = lazy(() => import('@/pages/legal/CopyrightClaimPage').then((m) => ({ default: m.CopyrightClaimPage })))
const SignInPage = lazy(() => import('@/pages/auth/SignInPage').then((m) => ({ default: m.SignInPage })))
const SignUpPage = lazy(() => import('@/pages/auth/SignUpPage').then((m) => ({ default: m.SignUpPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })))
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const AddRolePage = lazy(() => import('@/pages/onboarding/AddRolePage').then((m) => ({ default: m.AddRolePage })))

const FanDashboardLayout = lazy(() => import('@/pages/fan/FanDashboardLayout').then((m) => ({ default: m.FanDashboardLayout })))
const HomePage = lazy(() => import('@/pages/fan/HomePage').then((m) => ({ default: m.HomePage })))
const DiscoverPage = lazy(() => import('@/pages/fan/DiscoverPage').then((m) => ({ default: m.DiscoverPage })))
const SearchPage = lazy(() => import('@/pages/fan/SearchPage').then((m) => ({ default: m.SearchPage })))
const FollowingPage = lazy(() => import('@/pages/fan/FollowingPage').then((m) => ({ default: m.FollowingPage })))
const SupportedPage = lazy(() => import('@/pages/fan/SupportedPage').then((m) => ({ default: m.SupportedPage })))
const ListenerOffersPage = lazy(() => import('@/pages/fan/FanOffersPage').then((m) => ({ default: m.FanOffersPage })))
const LibraryPage = lazy(() => import('@/pages/fan/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const PlaylistsPage = lazy(() => import('@/pages/fan/PlaylistsPage').then((m) => ({ default: m.PlaylistsPage })))
const PlaylistDetailPage = lazy(() => import('@/pages/fan/PlaylistDetailPage').then((m) => ({ default: m.PlaylistDetailPage })))
const NotificationsPage = lazy(() => import('@/pages/fan/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const SubscriptionPage = lazy(() => import('@/pages/fan/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })))
const ProfilePage = lazy(() => import('@/pages/fan/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('@/pages/fan/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const ArtistPublicProfilePage = lazy(() => import('@/pages/artist/ArtistPublicProfilePage').then((m) => ({ default: m.ArtistPublicProfilePage })))
const ArtistDashboardLayout = lazy(() => import('@/pages/artist/dashboard/ArtistDashboardLayout').then((m) => ({ default: m.ArtistDashboardLayout })))
const OverviewPage = lazy(() => import('@/pages/artist/dashboard/OverviewPage').then((m) => ({ default: m.OverviewPage })))
const MusicPage = lazy(() => import('@/pages/artist/dashboard/MusicPage').then((m) => ({ default: m.MusicPage })))
const UploadTrackPage = lazy(() => import('@/pages/artist/dashboard/UploadTrackPage').then((m) => ({ default: m.UploadTrackPage })))
const StoriesPage = lazy(() => import('@/pages/artist/dashboard/StoriesPage').then((m) => ({ default: m.StoriesPage })))
const DjDealsPage = lazy(() => import('@/pages/artist/dashboard/DjDealsPage').then((m) => ({ default: m.DjDealsPage })))
const StoryAnalyticsPage = lazy(() => import('@/pages/artist/dashboard/StoryAnalyticsPage').then((m) => ({ default: m.StoryAnalyticsPage })))
const CommunityPage = lazy(() => import('@/pages/artist/dashboard/CommunityPage').then((m) => ({ default: m.CommunityPage })))
const ArtistFanOffersPage = lazy(() => import('@/pages/artist/dashboard/FanOffersPage').then((m) => ({ default: m.FanOffersPage })))
const ArtistDJRequestsPage = lazy(() => import('@/pages/artist/dashboard/DJRequestsPage').then((m) => ({ default: m.DJRequestsPage })))
const RevenuePage = lazy(() => import('@/pages/artist/dashboard/RevenuePage').then((m) => ({ default: m.RevenuePage })))
const ArtistSettingsPage = lazy(() => import('@/pages/artist/dashboard/ArtistSettingsPage').then((m) => ({ default: m.ArtistSettingsPage })))

const DJDashboardLayout = lazy(() => import('@/pages/dj/DJDashboardLayout').then((m) => ({ default: m.DJDashboardLayout })))
const DJDiscoverPage = lazy(() => import('@/pages/dj/DJDiscoverPage').then((m) => ({ default: m.DJDiscoverPage })))
const DJArtistsPage = lazy(() => import('@/pages/dj/DJArtistsPage').then((m) => ({ default: m.DJArtistsPage })))
const DJRequestsPage = lazy(() => import('@/pages/dj/DJRequestsPage').then((m) => ({ default: m.DJRequestsPage })))
const DJProfilePage = lazy(() => import('@/pages/dj/DJProfilePage').then((m) => ({ default: m.DJProfilePage })))
const DJPublicProfilePage = lazy(() => import('@/pages/dj/DJPublicProfilePage').then((m) => ({ default: m.DJPublicProfilePage })))
const DJCratesPage = lazy(() => import('@/pages/dj/DJCratesPage').then((m) => ({ default: m.DJCratesPage })))
const DJAnalyticsPage = lazy(() => import('@/pages/dj/DJAnalyticsPage').then((m) => ({ default: m.DJAnalyticsPage })))

const TrackPage = lazy(() => import('@/pages/track/TrackPage').then((m) => ({ default: m.TrackPage })))
const RequestDetailPage = lazy(() => import('@/pages/requests/RequestDetailPage').then((m) => ({ default: m.RequestDetailPage })))
const MyAgreementsPage = lazy(() => import('@/pages/agreements/MyAgreementsPage').then((m) => ({ default: m.MyAgreementsPage })))
const ContractPage = lazy(() => import('@/pages/agreements/ContractPage').then((m) => ({ default: m.ContractPage })))

const AdminDashboardLayout = lazy(() => import('@/pages/admin/AdminDashboardLayout').then((m) => ({ default: m.AdminDashboardLayout })))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })))
const AdminVerificationPage = lazy(() => import('@/pages/admin/AdminVerificationPage').then((m) => ({ default: m.AdminVerificationPage })))
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })))
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })))
const AdminAuditLogPage = lazy(() => import('@/pages/admin/AdminAuditLogPage').then((m) => ({ default: m.AdminAuditLogPage })))
const AdminSecurityIncidentsPage = lazy(() => import('@/pages/admin/AdminSecurityIncidentsPage').then((m) => ({ default: m.AdminSecurityIncidentsPage })))

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <PlayerProvider>
            <InstallBanner />
            <Suspense fallback={<LoadingState label="Loading…" />}>
            <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/for-djs" element={<ForDjsPage />} />
            <Route path="/for-artists" element={<ForArtistsPage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/terms" element={<LegalPage type="terms" />} />
            <Route path="/privacy" element={<LegalPage type="privacy" />} />
            <Route path="/copyright" element={<CopyrightPolicyPage />} />
            <Route
              path="/copyright/report"
              element={
                <ProtectedRoute>
                  <CopyrightClaimPage />
                </ProtectedRoute>
              }
            />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route
              path="/verify-email"
              element={
                <ProtectedRoute>
                  <VerifyEmailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/add-role"
              element={
                <ProtectedRoute>
                  <AddRolePage />
                </ProtectedRoute>
              }
            />

            <Route path="/artist/:slug" element={<ArtistPublicProfilePage />} />
            <Route path="/djs/:djId" element={<DJPublicProfilePage />} />
            <Route path="/artist/:slug/track/:trackId" element={<TrackPage />} />
            <Route path="/track/:trackId" element={<TrackPage />} />
            <Route
              path="/requests/:requestId"
              element={
                <ProtectedRoute>
                  <RequestDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agreements"
              element={
                <ProtectedRoute>
                  <MyAgreementsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agreements/:agreementId"
              element={
                <ProtectedRoute>
                  <ContractPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <RequireOnboarding>
                    <FanDashboardLayout />
                  </RequireOnboarding>
                </ProtectedRoute>
              }
            >
              <Route path="home" element={<HomePage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="following" element={<FollowingPage />} />
              <Route path="supported" element={<SupportedPage />} />
              <Route path="offers" element={<ListenerOffersPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="playlists" element={<PlaylistsPage />} />
              <Route path="playlists/:playlistId" element={<PlaylistDetailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route
              path="/dashboard/artist"
              element={
                <ProtectedRoute>
                  <RequireOnboarding>
                    <RoleRoute role="artist">
                      <ArtistDashboardLayout />
                    </RoleRoute>
                  </RequireOnboarding>
                </ProtectedRoute>
              }
            >
              <Route index element={<OverviewPage />} />
              <Route path="music" element={<MusicPage />} />
              <Route path="upload" element={<UploadTrackPage />} />
              <Route path="stories" element={<StoriesPage />} />
              <Route path="stories/analytics" element={<StoryAnalyticsPage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="offers" element={<ArtistFanOffersPage />} />
              <Route path="dj-requests" element={<ArtistDJRequestsPage />} />
              <Route path="deals" element={<DjDealsPage />} />
              <Route path="revenue" element={<RevenuePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="plan" element={<Navigate replace to="/dashboard/artist" />} />
              <Route path="settings" element={<ArtistSettingsPage />} />
            </Route>

            <Route
              path="/dj"
              element={
                <ProtectedRoute>
                  <RequireOnboarding>
                    <RoleRoute role="dj">
                      <DJDashboardLayout />
                    </RoleRoute>
                  </RequireOnboarding>
                </ProtectedRoute>
              }
            >
              <Route path="discover" element={<DJDiscoverPage />} />
              <Route path="artists" element={<DJArtistsPage />} />
              <Route path="requests" element={<DJRequestsPage />} />
              <Route path="sets" element={<DJCratesPage />} />
              <Route path="analytics" element={<DJAnalyticsPage />} />
              <Route path="profile" element={<DJProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="plan" element={<Navigate replace to="/dj/profile" />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <RoleRoute role="admin">
                    <AdminDashboardLayout />
                  </RoleRoute>
                </ProtectedRoute>
              }
            >
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="verification" element={<AdminVerificationPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="audit-log" element={<AdminAuditLogPage />} />
              <Route path="security-incidents" element={<AdminSecurityIncidentsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>
          </PlayerProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
