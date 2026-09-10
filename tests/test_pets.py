import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.pet import Pet

client = TestClient(app)





def test_create_pet_success(tracker) -> None:
    """Test creating a pet with valid data returns 201 and persists to DB."""
    payload = {
        "name": "Hank",
        "owner_name": "John Bergeson",
    }
    response = client.post("/pets", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert data["name"] == "Hank"
    assert data["owner_name"] == "John Bergeson"
    tracker(data["id"])

    # Verify persistence directly in the database
    db = SessionLocal()
    try:
        saved_pet = db.get(Pet, data["id"])
        assert saved_pet is not None
        assert saved_pet.name == "Hank"
        assert saved_pet.owner_name == "John Bergeson"
    finally:
        db.close()


def test_create_pet_strips_whitespace(tracker) -> None:
    """Test that leading/trailing whitespaces in name and owner_name are stripped."""
    payload = {
        "name": "   Rex Fluffy   ",
        "owner_name": "   Jane Doe   ",
    }
    response = client.post("/pets", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "Rex Fluffy"
    assert data["owner_name"] == "Jane Doe"
    tracker(data["id"])


def test_create_pet_missing_name() -> None:
    """Test creating a pet without name returns 422 Unprocessable Entity."""
    payload = {
        "owner_name": "John Bergeson",
    }
    response = client.post("/pets", json=payload)
    assert response.status_code == 422


def test_create_pet_missing_owner_name() -> None:
    """Test creating a pet without owner_name returns 422 Unprocessable Entity."""
    payload = {
        "name": "Hank",
    }
    response = client.post("/pets", json=payload)
    assert response.status_code == 422


def test_create_pet_empty_strings() -> None:
    """Test that empty string or string with only whitespace is rejected with 422."""
    # Empty name
    response = client.post("/pets", json={"name": "", "owner_name": "Alice"})
    assert response.status_code == 422

    # Whitespace-only name
    response = client.post("/pets", json={"name": "     ", "owner_name": "Alice"})
    assert response.status_code == 422

    # Whitespace-only owner_name
    response = client.post("/pets", json={"name": "Rex", "owner_name": "   "})
    assert response.status_code == 422


def test_get_pet_by_id_success(tracker) -> None:
    """Test retrieving an existing pet by its ID returns 200 OK."""
    # Create pet first
    create_res = client.post("/pets", json={"name": "Luna", "owner_name": "Carlos"})
    assert create_res.status_code == 201
    pet_id = create_res.json()["id"]
    tracker(pet_id)

    # Retrieve pet
    get_res = client.get(f"/pets/{pet_id}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["id"] == pet_id
    assert data["name"] == "Luna"
    assert data["owner_name"] == "Carlos"


def test_get_pet_by_id_not_found() -> None:
    """Test retrieving a non-existent pet returns 404 Not Found."""
    response = client.get("/pets/999999")
    assert response.status_code == 404
    assert "não encontrado" in response.json()["detail"].lower()


def test_list_pets(tracker) -> None:
    """Test listing pets returns a list containing created pets."""
    res1 = client.post("/pets", json={"name": "Pet1", "owner_name": "Owner1"})
    res2 = client.post("/pets", json={"name": "Pet2", "owner_name": "Owner2"})
    assert res1.status_code == 201
    assert res2.status_code == 201
    tracker(res1.json()["id"])
    tracker(res2.json()["id"])

    response = client.get("/pets")
    assert response.status_code == 200
    pets_list = response.json()
    assert isinstance(pets_list, list)
    assert len(pets_list) >= 2
    ids = [p["id"] for p in pets_list]
    assert res1.json()["id"] in ids
    assert res2.json()["id"] in ids
