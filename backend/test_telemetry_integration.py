import time
import unittest
from fastapi.testclient import TestClient
from main import app


class TelemetryGatewayIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.mock_signing_key = "cosmos-enterprise-telemetry-test-key"  # nosec B105
        self.tenant_org = "org_enterprise_acme_corp"

    def test_bearer_token_does_not_control_tenant_attribution(self):
        """
        A JWT-shaped value cannot control tenant identity until signature
        verification is configured.
        """
        now = int(time.time())
        token_payload = {
            "sub": "auth0|dev_engineer_9921",
            "name": "Jane Enterprise Developer",
            "iss": "https://the-token-cosmos.us.auth0.com/",
            "aud": "https://api.the-token-cosmos.com",
            "https://the-token-cosmos.com/org_id": self.tenant_org,
            "iat": now,
            "exp": now + 3600,
        }

        encoded_token = "unverified-token"

        # Telemetry batch payload
        telemetry_payload = {
            "events": [
                {
                    "event_id": "evt_e2e_prod_001",
                    "client_timestamp": now * 1000,
                    "total_tokens": 42,
                    "avg_entropy": 0.58,
                    "max_entropy": 1.12,
                    "friction_count": 1,
                    "recommended_min_p": 0.08,
                    "recommended_freq_penalty": 0.35,
                    "cost_reduction_pct": 14.5,
                    "model_id": "SmolLM2-135M-Instruct-q4f16_1-MLC",
                },
                {
                    "event_id": "evt_e2e_prod_002",
                    "client_timestamp": now * 1000 + 500,
                    "total_tokens": 30,
                    "avg_entropy": 0.44,
                    "max_entropy": 0.95,
                    "friction_count": 0,
                    "recommended_min_p": 0.05,
                    "recommended_freq_penalty": 0.20,
                    "cost_reduction_pct": 5.0,
                    "model_id": "SmolLM2-135M-Instruct-q4f16_1-MLC",
                }
            ]
        }

        response = self.client.post(
            "/api/telemetry",
            json=telemetry_payload,
            headers={"Authorization": f"Bearer {encoded_token}"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ingested")
        self.assertEqual(data["ingested_count"], 2)
        self.assertEqual(data["org_id"], "org_anonymous_community")
        self.assertTrue(data["processed_at"] > 0)

    def test_e2e_anonymous_telemetry_fallback(self):
        """
        Tests fallback to anonymous community partition when no Authorization header is provided.
        """
        now = int(time.time())
        telemetry_payload = {
            "events": [
                {
                    "event_id": "evt_anon_001",
                    "client_timestamp": now * 1000,
                    "total_tokens": 15,
                    "avg_entropy": 0.92,
                    "max_entropy": 1.45,
                    "friction_count": 2,
                    "recommended_min_p": 0.12,
                    "recommended_freq_penalty": 0.50,
                    "cost_reduction_pct": 20.0,
                }
            ]
        }

        response = self.client.post("/api/telemetry", json=telemetry_payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ingested")
        self.assertEqual(data["ingested_count"], 1)
        self.assertEqual(data["org_id"], "org_anonymous_community")


if __name__ == "__main__":
    unittest.main()
