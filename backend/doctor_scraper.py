import requests
import asyncio
import re
from typing import List, Dict
from urllib.parse import quote

from config import get_settings
from firecrawl import FirecrawlApp
from langsmith import traceable


class DoctorScraper:
    """
    Web scraper to find doctors using Firecrawl API.
    Extracts name, mobile number, designation, and location.
    """

    def __init__(self):
        settings = get_settings()
        self.firecrawl_api_key = settings.FIRECRAWL_API_KEY
        self.app = FirecrawlApp(api_key=self.firecrawl_api_key)

    @traceable(name="search_doctors_firecrawl")
    async def search_doctors(self, specialty: str, location: str, limit: int = 5) -> List[Dict]:
        """
        Search for doctors by specialty and location using Firecrawl Search API.
        Uses Firecrawl's native search functionality for better results.
        
        Args:
            specialty: Medical specialty (e.g., "Cardiologist", "Orthopedic")
            location: City or area name
            limit: Number of results to return
        
        Returns:
            List of doctor information with name, mobile, designation, location
        """
        
        # Build search query targeting doctor-finding websites
        query = f"{specialty} doctors in {location} site:practo.com OR site:1mg.com OR site:lybrate.com OR site:justdial.com"
        
        all_doctors = []
        
        try:
            print(f"[DEBUG] Firecrawl Search Query: {query}")
            
            # Use Firecrawl's search API with scraping enabled
            search_result = await asyncio.to_thread(
                self.app.search,
                query,  # First positional argument
                {  # Options as second argument
                    "limit": limit * 2,  # Get more results to filter
                    "scrapeOptions": {
                        "formats": ["markdown"],
                        "onlyMainContent": True
                    }
                }
            )
            
            # The SDK returns a list directly, not a dict with "success"
            if not search_result or not isinstance(search_result, list):
                print(f"[DEBUG] Firecrawl search failed or returned unexpected format: {type(search_result)}")
                return []
            
            # Process search results (search_result is already the data list)
            data = search_result
            
            print(f"[DEBUG] Firecrawl returned {len(data)} results")
            
            for result in data:
                # Extract doctor information from each result
                url = result.get("url", "")
                title = result.get("title", "")
                markdown = result.get("markdown", "")
                description = result.get("description", "")
                
                # Combine all text content for parsing
                combined_content = f"{title}\n{description}\n{markdown}"
                
                # Parse doctor information
                doctors = self._parse_doctors_from_content(
                    combined_content, 
                    "", 
                    location, 
                    url
                )
                
                if doctors:
                    # Add source URL to each doctor
                    for doctor in doctors:
                        doctor['link'] = url
                    all_doctors.extend(doctors)
                    print(f"[DEBUG] Extracted {len(doctors)} doctors from {url}")
            
        except Exception as e:
            print(f"[DEBUG] Firecrawl search error: {str(e)}")
            import traceback
            print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        
        # Remove duplicates based on doctor name
        unique_doctors = []
        seen_names = set()
        
        for doctor in all_doctors:
            name_key = doctor['name'].lower().strip()
            if name_key not in seen_names:
                seen_names.add(name_key)
                unique_doctors.append(doctor)
        
        print(f"[DEBUG] Total unique doctors found: {len(unique_doctors)}")
        return unique_doctors[:limit]
    
    def _parse_doctors_from_content(self, markdown_content: str, html_content: str, location: str, search_url: str = "") -> List[Dict]:
        """
        Parse doctor information from Firecrawl content.
        
        Args:
            markdown_content: Markdown content from Firecrawl
            html_content: HTML content from Firecrawl
            location: Search location
            search_url: Source URL for reference
        
        Returns:
            List of parsed doctor information
        """
        doctors = []
        
        # Combine both markdown and HTML content for parsing
        combined_content = f"{markdown_content}\n{html_content}"
        
        # Enhanced doctor name patterns
        doctor_patterns = [
            r'Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',  # Dr. FirstName LastName
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*,?\s*(MD|MBBS|MS|DM|MCh|DNB)',  # Name, Degree
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[-–]\s*(Cardiologist|Orthopedic|Neurologist|Dermatologist|Pediatrician|Gynecologist|Urologist|Ophthalmologist|ENT|Gastroenterologist|Pulmonologist|Psychiatrist|Surgeon|Physician|General\s+Physician)',
        ]
        
        # Specialty patterns
        specialty_patterns = [
            r'(Cardiologist|Cardiology)',
            r'(Orthopedic|Orthopedics|Orthopaedic)',
            r'(Neurologist|Neurology)',
            r'(Dermatologist|Dermatology)',
            r'(Pediatrician|Pediatrics)',
            r'(Gynecologist|Gynecology)',
            r'(Urologist|Urology)',
            r'(Ophthalmologist|Ophthalmology)',
            r'(ENT|Otolaryngology)',
            r'(Gastroenterologist|Gastroenterology)',
            r'(Pulmonologist|Pulmonology)',
            r'(Psychiatrist|Psychiatry)',
            r'(Surgeon|Surgery)',
            r'(General\s+Physician|General\s+Medicine|Physician)',
        ]
        
        # Extract potential doctor entries
        potential_doctors = []
        
        for pattern in doctor_patterns:
            matches = re.finditer(pattern, combined_content, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                groups = match.groups()
                name = groups[0].strip()
                specialty = groups[1].strip() if len(groups) > 1 else "General Physician"
                
                # Clean up name (remove extra spaces, titles)
                name = re.sub(r'\s+', ' ', name).strip()
                
                # Validate name (should have at least first and last name)
                if len(name.split()) >= 2 and len(name) > 5:
                    potential_doctors.append((name, specialty))
        
        # Extract phone numbers from the content
        phone_pattern = r'(?:\+91[\s\-]?)?([6-9]\d{9})'
        phone_numbers = re.findall(phone_pattern, combined_content)
        
        # Remove duplicates while preserving order
        seen_names = set()
        unique_doctors = []
        
        for name, specialty in potential_doctors:
            name_key = name.lower().strip()
            if name_key not in seen_names:
                seen_names.add(name_key)
                unique_doctors.append((name, specialty))
        
        # Create doctor entries
        for i, (name, specialty) in enumerate(unique_doctors[:10]):
            doctor_info = {
                'name': name,
                'mobile': phone_numbers[i] if i < len(phone_numbers) else '',
                'designation': specialty,
                'location': location,
                'specialty': specialty,
                'experience': '',
                'source': 'web_search',
                'link': search_url
            }
            
            # Try to extract experience from nearby text (within 200 chars of name)
            name_pos = combined_content.lower().find(name.lower())
            if name_pos != -1:
                context = combined_content[max(0, name_pos - 100):min(len(combined_content), name_pos + 200)]
                exp_match = re.search(r'(\d+)\s*(?:\+)?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)', context, re.IGNORECASE)
                if exp_match:
                    doctor_info['experience'] = f"{exp_match.group(1)} years"
            
            doctors.append(doctor_info)
        
        return doctors
    
    async def search_doctors_by_location(self, specialty: str, latitude: float, 
                                        longitude: float, radius_km: int = 10) -> List[Dict]:
        """
        Search for doctors near a specific location (lat/long) using Firecrawl.
        
        Args:
            specialty: Medical specialty
            latitude: Patient latitude
            longitude: Patient longitude
            radius_km: Search radius in kilometers
        
        Returns:
            List of nearby doctors
        """
        
        # Use coordinates in the search query
        location_query = f"near {latitude},{longitude}"
        
        return await self.search_doctors(specialty, location_query)
    
    async def get_doctor_details(self, doctor_url: str) -> Dict:
        """
        Scrape detailed information from doctor's profile/website using Firecrawl.
        
        Args:
            doctor_url: URL to doctor's profile or website
        
        Returns:
            Detailed doctor information
        """
        
        try:
            scrape_result = await asyncio.to_thread(
                self.app.scrape_url,
                url=doctor_url,
                params={
                    'formats': ['markdown'],
                    'onlyMainContent': True
                }
            )
            
            if not scrape_result.get('success'):
                print(f"Failed to scrape doctor details: {scrape_result.get('error', 'Unknown error')}")
                return {}
            
            content = scrape_result.get('data', {}).get('markdown', '')
            
            details = {
                'qualifications': [],
                'experience': '',
                'services': [],
                'fees': '',
                'availability': '',
                'clinic_address': ''
            }
            
            # Extract qualifications
            qual_patterns = [
                r'(?:MBBS|MD|MS|DM|MCh|FRCS|FACS)',
                r'(?:B\.?Sc|M\.?Sc|B\.?Tech|M\.?Tech)'
            ]
            
            for pattern in qual_patterns:
                matches = re.findall(pattern, content)
                details['qualifications'].extend(matches)
            
            # Extract clinic address
            address_match = re.search(r'(?:address|clinic|location)[:\-\s]*([^\n]{10,100})', content, re.IGNORECASE)
            if address_match:
                details['clinic_address'] = address_match.group(1).strip()[:200]
            
            # Extract experience
            exp_match = re.search(r'(\d+)\s*(?:years?|yrs?)\s*(?:experience|exp)', content, re.IGNORECASE)
            if exp_match:
                details['experience'] = f"{exp_match.group(1)} years"
            
            return details
        
        except Exception as e:
            print(f"Error getting doctor details with Firecrawl: {str(e)}")
            return {}


# Singleton instance
_scraper = None

def get_doctor_scraper() -> DoctorScraper:
    """Get or create doctor scraper instance"""
    global _scraper
    if _scraper is None:
        _scraper = DoctorScraper()
    return _scraper
