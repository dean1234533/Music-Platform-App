import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { PlayerProvider } from '@/contexts/PlayerContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { ProtectedRoute, RequireOnboarding } from '@/components/auth/ProtectedRoute'
import { RoleRoute } from '@/components/auth/RoleRoute'
import { InstallBanner } from '@/components/pwa/InstallBanner'

import { LandingPage } from '@/pages/marketing/LandingPage'
import { PricingPage } from '@/pages/marketing/PricingPage'
import { LegalPage } from '@/pages/marketing/LegalPage'
import { CopyrightPolicyPage } from '@/pages/legal/CopyrightPolicyPage'
import { CopyrightClaimPage } from '@/pages/legal/CopyrightClaimPage'
import { SignInPage } from '@/pages/auth/SignInPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage'
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'
import { AddRolePage } from '@/pages/onboarding/AddRolePage'

import { FanDashboardLayout } from '@/pages/fan/FanDashboardLayout'
import { HomePage } from '@/pages/fan/HomePage'
import { DiscoverPage } from '@/pages/fan/DiscoverPage'
import { SearchPage } from '@/pages/fan/SearchPage'
import { FollowingPage } from '@/pages/fan/FollowingPage'
import { SupportedPage } from '@/pages/fan/SupportedPage'
import { FanOffersPage as ListenerOffersPage } from '@/pages/fan/FanOffersPage'
import { LibraryPage } from '@/pages/fan/LibraryPage'
import { PlaylistsPage } from '@/pages/fan/PlaylistsPage'
import { PlaylistDetailPage } from '@/pages/fan/PlaylistDetailPage'
import { NotificationsPage } from '@/pages/fan/NotificationsPage'
import { SubscriptionPage } from '@/pages/fan/SubscriptionPage'
import { ProfilePage } from '@/pages/fan/ProfilePage'
import { SettingsPage } from '@/pages/fan/SettingsPage'

import { ArtistPublicProfilePage } from '@/pages/artist/ArtistPublicProfilePage'
import { ArtistDashboardLayout } from '@/pages/artist/dashboard/ArtistDashboardLayout'
import { OverviewPage } from '@/pages/artist/dashboard/OverviewPage'
import { MusicPage } from '@/pages/artist/dashboard/MusicPage'
import { UploadTrackPage } from '@/pages/artist/dashboard/UploadTrackPage'
import { StoriesPage } from '@/pages/artist/dashboard/StoriesPage'
import { DjDealsPage } from '@/pages/artist/dashboard/DjDealsPage'
import { StoryAnalyticsPage } from '@/pages/artist/dashboard/StoryAnalyticsPage'
import { CommunityPage } from '@/pages/artist/dashboard/CommunityPage'
import { FanOffersPage as ArtistFanOffersPage } from '@/pages/artist/dashboard/FanOffersPage'
import { DJRequestsPage as ArtistDJRequestsPage } from '@/pages/artist/dashboard/DJRequestsPage'
import { RevenuePage } from '@/pages/artist/dashboard/RevenuePage'
import { ArtistSettingsPage } from '@/pages/artist/dashboard/ArtistSettingsPage'

import { DJDashboardLayout } from '@/pages/dj/DJDashboardLayout'
import { DJDiscoverPage } from '@/pages/dj/DJDiscoverPage'
import { DJRequestsPage } from '@/pages/dj/DJRequestsPage'
import { DJProfilePage } from '@/pages/dj/DJProfilePage'
import { DJPublicProfilePage } from '@/pages/dj/DJPublicProfilePage'
import { DJCratesPage } from '@/pages/dj/DJCratesPage'
import { DJAnalyticsPage } from '@/pages/dj/DJAnalyticsPage'

import { TrackPage } from '@/pages/track/TrackPage'
import { RequestDetailPage } from '@/pages/requests/RequestDetailPage'
import { MyAgreementsPage } from '@/pages/agreements/MyAgreementsPage'
import { ContractPage } from '@/pages/agreements/ContractPage'

import { AdminDashboardLayout } from '@/pages/admin/AdminDashboardLayout'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AdminVerificationPage } from '@/pages/admin/AdminVerificationPage'
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage'
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage'
import { AdminAuditLogPage } from '@/pages/admin/AdminAuditLogPage'
import { AdminSecurityIncidentsPage } from '@/pages/admin/AdminSecurityIncidentsPage'

import { NotFoundPage } from '@/pages/NotFoundPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <PlayerProvider>
            <InstallBanner />
            <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
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
              <Route path="requests" element={<DJRequestsPage />} />
              <Route path="crates" element={<DJCratesPage />} />
              <Route path="analytics" element={<DJAnalyticsPage />} />
              <Route path="profile" element={<DJProfilePage />} />
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
          </PlayerProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
