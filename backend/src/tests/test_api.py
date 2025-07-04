import requests
import json
from datetime import datetime
from typing import Dict, Any


def test_all_stats() -> Dict[str, Any]:
    """
    Test endpoint /api/all_stats
    Returns the response data if successful
    """
    base_url = "http://localhost:8000/api"  # Zmieniony URL - usunięty v1

    try:
        response = requests.get(f"{base_url}/all_stats")
        response.raise_for_status()  # Sprawdź czy nie ma błędu HTTP

        data = response.json()

        # Podstawowe sprawdzenie struktury odpowiedzi
        assert "summary" in data, "Brak klucza 'summary' w odpowiedzi"
        assert "ph" in data, "Brak klucza 'ph' w odpowiedzi"
        assert "branches" in data, "Brak klucza 'branches' w odpowiedzi"

        # Sprawdzenie czy wszystkie oddziały są obecne
        expected_branches = {"Rzgów", "Malbork", "Pcim", "Lublin", "Łomża", "Myślibórz"}
        actual_branches = set(data["branches"].keys())
        assert expected_branches == actual_branches, f"Brakujące oddziały: {expected_branches - actual_branches}"

        # Sprawdzenie struktury danych dla każdego bloku
        blocks_to_check = ["summary", "ph"] + list(data["branches"].keys())

        for block in blocks_to_check:
            block_data = data["branches"][block] if block in data["branches"] else data[block]

            # Sprawdź strukturę daily
            assert "daily" in block_data, f"Brak danych daily dla {block}"
            assert "net_sales" in block_data["daily"], f"Brak net_sales w daily dla {block}"
            assert "profit" in block_data["daily"], f"Brak profit w daily dla {block}"

            # Sprawdź strukturę monthly
            assert "monthly" in block_data, f"Brak danych monthly dla {block}"
            assert "net_sales" in block_data["monthly"], f"Brak net_sales w monthly dla {block}"
            assert "profit" in block_data["monthly"], f"Brak profit w monthly dla {block}"

            # Sprawdź dane historyczne
            assert "historical" in block_data, f"Brak danych historical dla {block}"
            assert len(block_data["historical"]) == 3, f"Nieprawidłowa liczba miesięcy w historical dla {block}"

        print("✅ Wszystkie testy przeszły pomyślnie!")

        # Wyświetl przykładowe wartości
        print("\nPrzykładowe wartości:")
        print(f"Dzisiejsza sprzedaż (net_sales): {data['summary']['daily']['net_sales']:.2f}")
        print(f"Dzisiejszy zysk (profit): {data['summary']['daily']['profit']:.2f}")

        return data

    except requests.exceptions.RequestException as e:
        print(f"❌ Błąd połączenia z API: {e}")
        raise
    except AssertionError as e:
        print(f"❌ Błąd walidacji danych: {e}")
        raise
    except Exception as e:
        print(f"❌ Nieoczekiwany błąd: {e}")
        raise


if __name__ == "__main__":
    try:
        data = test_all_stats()

        # Zapisz wyniki do pliku dla późniejszej analizy
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        with open(f"api_test_results_{timestamp}.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"\nWyniki zostały zapisane do pliku: api_test_results_{timestamp}.json")

    except Exception as e:
        print(f"Test zakończony niepowodzeniem: {e}")