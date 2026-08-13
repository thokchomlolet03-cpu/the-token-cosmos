import unittest

from main import LogitRequest, api_health, get_logits


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


if __name__ == "__main__":
    unittest.main()
