import asyncio
# pyrefly: ignore [missing-import]
import httpx
from database import init_indexes
from services.facility_service import FacilityService

async def run_test():
    print("Initializing indexes and seeding facility database...")
    await init_indexes()
    await FacilityService.ensure_seeded()

    from main import app
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Test 1: Query nearby facilities around Kurla / Ghatkopar (19.0650, 72.8790) with 5km radius
        print("\n--- Test 1: Query 5km radius around Kurla (19.0650, 72.8790) ---")
        res1 = await client.get("/api/access/nearby", params={"lat": 19.0650, "lng": 72.8790, "radius_km": 5.0})
        assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.text}"
        data1 = res1.json()
        print(f"Status: {res1.status_code}")
        print(f"User location: {data1['user_location']}")
        print(f"Returned facilities count: {data1['count']}")
        for fac in data1['facilities']:
            print(f" - {fac['name']} ({fac['type']}) : {fac['distance_km']} km away")
        
        demo = data1.get('featured_demo_facility')
        print(f"Featured demo facility: {demo['name']} - {demo['distance_km']} km away (within 5km: {demo['is_within_radius']})")

        # Test 2: Query nearby facilities with 10km radius
        print("\n--- Test 2: Query 10km radius around Bandra (19.0550, 72.8310) ---")
        res2 = await client.get("/api/access/nearby", params={"lat": 19.0550, "lng": 72.8310, "radius_km": 10.0})
        assert res2.status_code == 200, f"Expected 200, got {res2.status_code}"
        data2 = res2.json()
        print(f"Returned facilities count in 10km: {data2['count']}")

        # Test 3: Invalid coordinates validation
        print("\n--- Test 3: Invalid coordinates validation ---")
        res3 = await client.get("/api/access/nearby", params={"lat": 120.0, "lng": 72.8790})
        assert res3.status_code == 400, f"Expected 400 Bad Request, got {res3.status_code}"
        print(f"Received expected validation error: {res3.json()['detail']}")

    print("\n[SUCCESS] All backend geospatial discovery tests passed successfully!")

if __name__ == "__main__":
    asyncio.run(run_test())
