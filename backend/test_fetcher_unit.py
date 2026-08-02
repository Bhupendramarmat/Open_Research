import unittest
from unittest.mock import patch

import fetcher


class FetcherOptimizationTests(unittest.TestCase):
    def test_fetch_papers_passes_requested_limit_to_each_source(self):
        query = "machine learning medical imaging"
        requested_limit = 20

        with (
            patch("fetcher.fetch_semantic_papers", return_value=[]) as semantic_mock,
            patch("fetcher.fetch_pubmed_papers", return_value=[]) as pubmed_mock,
            patch("fetcher.fetch_europe_pmc_papers", return_value=[]) as europe_mock,
            patch("fetcher.fetch_crossref_papers", return_value=[]) as crossref_mock,
            patch("fetcher.fetch_openalex_papers", return_value=[]) as openalex_mock,
        ):
            papers, source_summary = fetcher.fetch_papers(query, limit=requested_limit)

        semantic_mock.assert_called_once_with(query, requested_limit)
        pubmed_mock.assert_called_once_with(query, requested_limit)
        europe_mock.assert_called_once_with(query, requested_limit)
        crossref_mock.assert_called_once_with(query, requested_limit)
        openalex_mock.assert_called_once_with(query, requested_limit)

        self.assertEqual(papers, [])
        self.assertEqual(source_summary["semantic_scholar"], 0)
        self.assertEqual(source_summary["pubmed"], 0)
        self.assertEqual(source_summary["europe_pmc"], 0)
        self.assertEqual(source_summary["crossref"], 0)
        self.assertEqual(source_summary["openalex"], 0)
        self.assertFalse(source_summary["both_sources_used"])


if __name__ == "__main__":
    unittest.main()
