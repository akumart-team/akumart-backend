# Registered AkuMart API endpoints

Generated with `npm run api:export`. Request schemas are in [openapi.json](openapi.json); setup and access rules are in [FRONTEND_API.md](FRONTEND_API.md). Staff restrictions are enforced in addition to bearer authentication.

| Module | Method | Path | Authentication | Body schema |
| --- | --- | --- | --- | --- |
| Administration | GET | `/api/v1/admin/audit` | Bearer | — |
| Administration | GET | `/api/v1/admin/dashboard` | Bearer | — |
| Administration | GET | `/api/v1/admin/finance/payments` | Bearer | — |
| Administration | GET | `/api/v1/admin/me` | Bearer | — |
| Administration | GET | `/api/v1/admin/orders` | Bearer | — |
| Administration | GET | `/api/v1/admin/orders/{id}` | Bearer | — |
| Administration | POST | `/api/v1/admin/orders/{id}/holds` | Bearer | HoldDto |
| Administration | POST | `/api/v1/admin/orders/{id}/holds/{holdId}/release` | Bearer | HoldDto |
| Administration | GET | `/api/v1/admin/settings` | Bearer | — |
| Administration | PATCH | `/api/v1/admin/settings` | Bearer | SettingsDto |
| Administration | POST | `/api/v1/admin/settings` | Bearer | — |
| Administration | GET | `/api/v1/admin/staff` | Bearer | — |
| Administration | PUT | `/api/v1/admin/staff/{profileId}` | Bearer | AssignStaffDto |
| Administration | POST | `/api/v1/admin/staff/bootstrap` | Bearer | — |
| Administration | GET | `/api/v1/admin/users` | Bearer | — |
| Administration | GET | `/api/v1/admin/users/{id}` | Bearer | — |
| Advertising | GET | `/api/v1/admin/advertising/campaigns` | Bearer | — |
| Advertising | PATCH | `/api/v1/admin/advertising/campaigns/{id}` | Bearer | CampaignDecisionDto |
| Advertising | PUT | `/api/v1/admin/advertising/packages` | Bearer | AdvertisingPackageDto |
| Advertising | GET | `/api/v1/advertising/campaigns` | Bearer | — |
| Advertising | POST | `/api/v1/advertising/campaigns` | Bearer | CampaignDto |
| Advertising | GET | `/api/v1/advertising/campaigns/{id}/stats` | Bearer | — |
| Advertising | POST | `/api/v1/advertising/events` | Public / optional bearer | CampaignTrackingDto |
| Advertising | GET | `/api/v1/advertising/packages` | Public / optional bearer | — |
| Advertising | GET | `/api/v1/advertising/placements` | Public / optional bearer | — |
| AkuBin | GET | `/api/v1/akubin/bins` | Public / optional bearer | — |
| AkuBin | GET | `/api/v1/akubin/bins/{code}` | Public / optional bearer | — |
| AkuBin | GET | `/api/v1/akubin/leaderboard` | Bearer | — |
| AkuBin | GET | `/api/v1/akubin/locations` | Public / optional bearer | — |
| AkuBin | GET | `/api/v1/akubin/locations/{code}` | Public / optional bearer | — |
| AkuBin | GET | `/api/v1/akubin/reward-rules` | Public / optional bearer | — |
| AkuBin | GET | `/api/v1/akubin/rewards` | Public / optional bearer | — |
| AkuBin | POST | `/api/v1/akubin/sessions/{id}/deposits` | Public / optional bearer | RecordDepositDto |
| AkuBin | POST | `/api/v1/akubin/sessions/phone-pin` | Public / optional bearer | StartBinSessionDto |
| AkuBin Account | GET | `/api/v1/akubin/me/deposits` | Bearer | — |
| AkuBin Account | GET | `/api/v1/akubin/me/pin` | Bearer | — |
| AkuBin Account | PUT | `/api/v1/akubin/me/pin` | Bearer | SetBinPinDto |
| AkuBin Account | GET | `/api/v1/akubin/me/points-ledger` | Bearer | — |
| AkuBin Account | GET | `/api/v1/akubin/me/redemptions` | Bearer | — |
| AkuBin Account | GET | `/api/v1/akubin/me/sessions` | Bearer | — |
| AkuBin Account | GET | `/api/v1/akubin/me/sessions/{id}` | Bearer | — |
| AkuBin Account | POST | `/api/v1/akubin/me/sessions/{id}/end` | Bearer | — |
| AkuBin Account | GET | `/api/v1/akubin/me/summary` | Bearer | — |
| AkuBin Account | GET | `/api/v1/akubin/me/wallet` | Bearer | — |
| AkuBin Account | POST | `/api/v1/akubin/redemptions` | Bearer | RedeemRewardDto |
| AkuBin Administration | GET | `/api/v1/admin/akubin/bins` | Bearer | — |
| AkuBin Administration | POST | `/api/v1/admin/akubin/bins` | Bearer | CreateBinDto |
| AkuBin Administration | PATCH | `/api/v1/admin/akubin/bins/{id}` | Bearer | UpdateBinDto |
| AkuBin Administration | POST | `/api/v1/admin/akubin/bins/{id}/collections` | Bearer | CollectionDto |
| AkuBin Administration | GET | `/api/v1/admin/akubin/bins/{id}/devices` | Bearer | — |
| AkuBin Administration | POST | `/api/v1/admin/akubin/bins/{id}/devices` | Bearer | RegisterBinDeviceDto |
| AkuBin Administration | GET | `/api/v1/admin/akubin/bins/{id}/events` | Bearer | — |
| AkuBin Administration | GET | `/api/v1/admin/akubin/bins/{id}/maintenance-tickets` | Bearer | — |
| AkuBin Administration | POST | `/api/v1/admin/akubin/bins/{id}/maintenance-tickets` | Bearer | MaintenanceDto |
| AkuBin Administration | POST | `/api/v1/admin/akubin/bins/{id}/maintenance-tickets/{ticketId}/resolve` | Bearer | — |
| AkuBin Administration | GET | `/api/v1/admin/akubin/bins/{id}/telemetry` | Bearer | — |
| AkuBin Administration | DELETE | `/api/v1/admin/akubin/devices/{id}` | Bearer | — |
| AkuBin Administration | GET | `/api/v1/admin/akubin/redemptions` | Bearer | — |
| AkuBin Administration | POST | `/api/v1/admin/akubin/redemptions/{id}/decision` | Bearer | RedemptionDecisionDto |
| AkuBin Administration | POST | `/api/v1/admin/akubin/redemptions/{id}/fulfillment` | Bearer | FulfillRedemptionDto |
| AkuBin Administration | PATCH | `/api/v1/admin/akubin/reward-rules` | Bearer | UpdateRewardRulesDto |
| AkuBin Administration | POST | `/api/v1/admin/akubin/rewards` | Bearer | CreateRewardDto |
| AkuBin Administration | DELETE | `/api/v1/admin/akubin/rewards/{id}` | Bearer | — |
| AkuBin Hardware | POST | `/api/v1/webhooks/akubin-telemetry` | Public / optional bearer | BinTelemetryDto |
| App | GET | `/` | Public / optional bearer | — |
| Articles and news | GET | `/api/v1/admin/articles` | Bearer | — |
| Articles and news | POST | `/api/v1/admin/articles` | Bearer | ArticleDto |
| Articles and news | PATCH | `/api/v1/admin/articles/{id}` | Bearer | UpdateArticleDto |
| Articles and news | GET | `/api/v1/admin/articles/{slug}` | Bearer | — |
| Articles and news | GET | `/api/v1/admin/news` | Bearer | — |
| Articles and news | POST | `/api/v1/admin/news` | Bearer | NewsDto |
| Articles and news | PATCH | `/api/v1/admin/news/{id}` | Bearer | NewsDecisionDto |
| Articles and news | GET | `/api/v1/articles` | Public / optional bearer | — |
| Articles and news | GET | `/api/v1/articles/{slug}` | Public / optional bearer | — |
| Articles and news | GET | `/api/v1/news` | Public / optional bearer | — |
| Articles and news | GET | `/api/v1/users/me/saved-articles` | Bearer | — |
| Articles and news | DELETE | `/api/v1/users/me/saved-articles/{id}` | Bearer | — |
| Articles and news | PUT | `/api/v1/users/me/saved-articles/{id}` | Bearer | — |
| Assistant | GET | `/api/v1/assistant/conversations/{id}` | Public / optional bearer | — |
| Assistant | POST | `/api/v1/assistant/messages` | Public / optional bearer | AssistantMessageDto |
| Auth | POST | `/api/v1/auth/forgot-password` | Public / optional bearer | EmailDto |
| Auth | POST | `/api/v1/auth/login` | Public / optional bearer | LoginDto |
| Auth | POST | `/api/v1/auth/logout` | Bearer | — |
| Auth | GET | `/api/v1/auth/me` | Bearer | — |
| Auth | POST | `/api/v1/auth/oauth/callback` | Public / optional bearer | OAuthCallbackDto |
| Auth | POST | `/api/v1/auth/refresh` | Public / optional bearer | — |
| Auth | POST | `/api/v1/auth/register` | Public / optional bearer | RegisterDto |
| Auth | POST | `/api/v1/auth/resend-code` | Public / optional bearer | EmailDto |
| Auth | POST | `/api/v1/auth/reset-password` | Public / optional bearer | ResetPasswordDto |
| Auth | POST | `/api/v1/auth/verify-email` | Public / optional bearer | VerifyCodeDto |
| Buyer Requests | GET | `/api/v1/buyer-requests` | Bearer | — |
| Buyer Requests | POST | `/api/v1/buyer-requests` | Bearer | CreateBuyerRequestDto |
| Buyer Requests | GET | `/api/v1/buyer-requests/{id}` | Bearer | — |
| Buyer Requests | POST | `/api/v1/buyer-requests/{id}/responses` | Bearer | RequestResponseDto |
| Buyer Requests | PATCH | `/api/v1/buyer-requests/{id}/responses/{responseId}` | Bearer | ReviewRequestResponseDto |
| Buyer Requests | GET | `/api/v1/users/me/buyer-requests` | Bearer | — |
| Health | GET | `/health` | Public / optional bearer | — |
| Health | GET | `/health/live` | Public / optional bearer | — |
| Listings | GET | `/api/v1/admin/listings` | Bearer | — |
| Listings | PATCH | `/api/v1/admin/listings/{id}/moderation` | Bearer | ModerateListingDto |
| Listings | GET | `/api/v1/listings` | Public / optional bearer | — |
| Listings | POST | `/api/v1/listings` | Bearer | CreateListingDto |
| Listings | GET | `/api/v1/listings/{id}` | Public / optional bearer | — |
| Listings | PATCH | `/api/v1/listings/{id}` | Bearer | UpdateListingDto |
| Listings | POST | `/api/v1/listings/{id}/reports` | Bearer | ReportListingDto |
| Listings | GET | `/api/v1/sellers/{id}/reviews` | Public / optional bearer | — |
| Listings | GET | `/api/v1/users/me/listings` | Bearer | — |
| Listings | GET | `/api/v1/users/me/saved-listings` | Bearer | — |
| Listings | DELETE | `/api/v1/users/me/saved-listings/{id}` | Bearer | — |
| Listings | PUT | `/api/v1/users/me/saved-listings/{id}` | Bearer | — |
| Logistics partners | GET | `/api/v1/admin/partners` | Bearer | — |
| Logistics partners | PATCH | `/api/v1/admin/partners/{id}` | Bearer | PartnerDecisionDto |
| Logistics partners | POST | `/api/v1/partners/applications` | Bearer | PartnerApplicationDto |
| Logistics partners | GET | `/api/v1/partners/me` | Bearer | — |
| Logistics partners | GET | `/api/v1/partners/me/deliveries` | Bearer | — |
| Logistics partners | POST | `/api/v1/partners/me/deliveries/{id}/events` | Bearer | DeliveryEventDto |
| Logistics partners | POST | `/api/v1/partners/me/deliveries/{id}/proof` | Bearer | DeliveryProofDto |
| Logistics partners | GET | `/api/v1/partners/me/jobs` | Bearer | — |
| Logistics partners | POST | `/api/v1/partners/me/jobs/{id}/decline` | Bearer | DeclineJobDto |
| Logistics partners | POST | `/api/v1/partners/me/jobs/{id}/quotes` | Bearer | QuoteDto |
| Notifications | GET | `/api/v1/users/me/notifications` | Bearer | — |
| Notifications | PATCH | `/api/v1/users/me/notifications/{id}` | Bearer | — |
| Notifications | POST | `/api/v1/users/me/notifications/read-all` | Bearer | — |
| Offers | POST | `/api/v1/listings/{id}/offers` | Bearer | OfferTermsDto |
| Offers | GET | `/api/v1/offers/{id}` | Bearer | — |
| Offers | POST | `/api/v1/offers/{id}/accept` | Bearer | — |
| Offers | POST | `/api/v1/offers/{id}/counteroffers` | Bearer | OfferTermsDto |
| Offers | POST | `/api/v1/offers/{id}/reject` | Bearer | — |
| Offers | GET | `/api/v1/users/me/offers` | Bearer | — |
| Orders | GET | `/api/v1/orders` | Bearer | — |
| Orders | GET | `/api/v1/orders/{id}` | Bearer | — |
| Orders | POST | `/api/v1/orders/{id}/cancel` | Bearer | — |
| Orders | POST | `/api/v1/orders/{id}/confirm-receipt` | Bearer | — |
| Orders | POST | `/api/v1/orders/{id}/disputes` | Bearer | DisputeDto |
| Orders | POST | `/api/v1/orders/{id}/fulfilment` | Bearer | FulfilmentDto |
| Orders | GET | `/api/v1/orders/{id}/logistics/estimate` | Bearer | — |
| Orders | GET | `/api/v1/orders/{id}/quotes` | Bearer | — |
| Orders | POST | `/api/v1/orders/{id}/quotes/extend` | Bearer | — |
| Orders | POST | `/api/v1/orders/{id}/quotes/select` | Bearer | SelectQuoteDto |
| Orders | POST | `/api/v1/orders/{id}/review` | Bearer | ReviewDto |
| Payments and finance | POST | `/api/v1/admin/advertising/campaigns/{id}/refund` | Bearer | — |
| Payments and finance | GET | `/api/v1/admin/disputes` | Bearer | — |
| Payments and finance | POST | `/api/v1/admin/disputes/{id}/decision` | Bearer | DisputeDecisionDto |
| Payments and finance | POST | `/api/v1/admin/orders/{id}/release` | Bearer | — |
| Payments and finance | POST | `/api/v1/admin/refunds/{id}/retry` | Bearer | — |
| Payments and finance | POST | `/api/v1/admin/refunds/{reference}/reconcile` | Bearer | — |
| Payments and finance | POST | `/api/v1/admin/transfers/{reference}/reconcile` | Bearer | — |
| Payments and finance | POST | `/api/v1/advertising/campaigns/{id}/checkout` | Bearer | — |
| Payments and finance | POST | `/api/v1/orders/{id}/checkout` | Bearer | — |
| Payments and finance | GET | `/api/v1/payments/{id}` | Bearer | — |
| Payments and finance | POST | `/api/v1/payments/{id}/verify` | Bearer | — |
| Payments and finance | GET | `/api/v1/payments/banks/nigeria` | Bearer | — |
| Payments and finance | GET | `/api/v1/users/me/payout-recipient` | Bearer | — |
| Payments and finance | POST | `/api/v1/users/me/payout-recipient` | Bearer | RecipientDto |
| Payments and finance | POST | `/api/v1/webhooks/paystack` | Public / optional bearer | — |
| Recommendations | GET | `/api/v1/recommendations/articles` | Public / optional bearer | — |
| Recommendations | POST | `/api/v1/recommendations/events` | Bearer | RecommendationEventDto |
| Recommendations | GET | `/api/v1/recommendations/jobs` | Bearer | — |
| Recommendations | GET | `/api/v1/recommendations/listings` | Public / optional bearer | — |
| Recommendations | GET | `/api/v1/recommendations/listings/{id}/similar` | Public / optional bearer | — |
| Support | GET | `/api/v1/admin/enquiries` | Bearer | — |
| Support | GET | `/api/v1/admin/support/tickets` | Bearer | — |
| Support | PATCH | `/api/v1/admin/support/tickets/{id}` | Bearer | UpdateTicketDto |
| Support | POST | `/api/v1/enquiries` | Public / optional bearer | EnquiryDto |
| Support | POST | `/api/v1/support/tickets` | Public / optional bearer | TicketDto |
| Support | GET | `/api/v1/users/me/support/tickets` | Bearer | — |
| Uploads | POST | `/api/v1/uploads` | Bearer | object |
| Uploads | GET | `/api/v1/uploads/{id}/access` | Public / optional bearer | — |
| Users | GET | `/api/v1/users/me` | Bearer | — |
| Users | PATCH | `/api/v1/users/me` | Bearer | UpdateProfileDto |
| Users | GET | `/api/v1/users/me/dashboard` | Bearer | — |
| Users | POST | `/api/v1/users/me/onboarding/complete` | Bearer | PreferencesDto |
| Users | PATCH | `/api/v1/users/me/preferences` | Bearer | UpdatePreferencesDto |
| Verification | GET | `/api/v1/admin/verifications` | Bearer | — |
| Verification | POST | `/api/v1/admin/verifications/{id}/decision` | Bearer | VerificationDecisionDto |
| Verification | GET | `/api/v1/users/me/verification` | Bearer | — |
| Verification | POST | `/api/v1/users/me/verification/submissions` | Bearer | SubmitVerificationDto |

Total: 177 operations.

Assistant history retrieval is retired (410 Gone). `POST /api/v1/assistant/messages` is stateless; see [FRONTEND_API.md](FRONTEND_API.md#recommendations-and-assistant).
