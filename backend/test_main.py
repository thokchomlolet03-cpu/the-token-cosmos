import unittest
import asyncio
from unittest.mock import MagicMock

from main import (
    LogitRequest,
    api_health,
    get_logits,
    TelemetryBatchRequest,
    TelemetryFrictionEvent,
    ingest_telemetry,
)


class LogitEndpointTests(unittest.TestCase):
    def test_health_reports_an_engine(self):
        health = api_health()
        self.assertEqual(health["status"], "online")
        self.assertTrue(health["engine"])

    def test_logit_response_honors_candidate_limit_and_rag(self):
        response = get_logits(
            LogitRequest(
                prompt="Which law applies to this agreement?",
                rag_context="The agreement is governed by Delaware law.",
                top_n=7,
            )
        )

        self.assertEqual(len(response.candidates), 7)
        self.assertTrue(response.rag_enabled)
        self.assertEqual(
            [candidate.raw_logit for candidate in response.candidates],
            sorted((candidate.raw_logit for candidate in response.candidates), reverse=True),
        )
        if response.engine == "synthetic-cosmos-engine":
            self.assertTrue(any(candidate.is_rag_grounded for candidate in response.candidates))

    def test_telemetry_ingest(self):
        event = TelemetryFrictionEvent(
            event_id="evt_test_123",
            client_timestamp=1786815000000,
            total_tokens=25,
            avg_entropy=0.85,
            max_entropy=1.2,
            friction_count=2,
            recommended_min_p=0.08,
            recommended_freq_penalty=0.4,
            cost_reduction_pct=15.0,
        )
        req = TelemetryBatchRequest(events=[event])
        mock_http_request = MagicMock()
        mock_http_request.headers = {"Authorization": "Bearer tc_jwt_test"}

        result = asyncio.run(ingest_telemetry(req, mock_http_request))
        self.assertEqual(result.status, "ingested")
        self.assertEqual(result.ingested_count, 1)
        self.assertTrue(result.org_id)


if __name__ == "__main__":
    unittest.main()

