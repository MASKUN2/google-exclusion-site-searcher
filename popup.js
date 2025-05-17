// DOM 요소 가져오기
const keywordInput = document.getElementById('keywordInput');
const domainInput = document.getElementById('domainInput');
const addDomainButton = document.getElementById('addDomainButton');
const useCurrentButton = document.getElementById('useCurrentButton');
const excludedSitesList = document.getElementById('excludedSitesList');
const searchButton = document.getElementById('searchButton');

// 제외할 사이트 목록을 저장할 Key (chrome.storage에서 사용)
const EXCLUDED_SITES_KEY = 'excludedSites';

// --- 유틸리티 함수 ---
/**
 * URL에서 도메인을 추출하는 함수
 * 예: "https://www.example.com/path" -> "example.com"
 */
function getDomainFromUrl(url) {
    try {
        const urlObject = new URL(url);
        // www.google.com -> google.com 과 같이 www 제거를 원하면 추가 처리 가능
        // 여기서는 hostname 그대로 사용
        return urlObject.hostname.replace(/^www\./, ''); // 기본적인 www. 제거
    } catch (e) {
        console.error("Invalid URL:", url, e);
        return null; // 유효하지 않은 URL인 경우 null 반환
    }
}

// --- 제외 목록 관련 함수 ---
/**
 * 저장된 제외 사이트 목록을 화면에 렌더링하는 함수
 */
function renderExcludedSites(sites = []) {
    excludedSitesList.innerHTML = ''; // 기존 목록 초기화
    if (sites && sites.length > 0) {
        sites.forEach(site => {
            const listItem = document.createElement('li');
            listItem.textContent = site;

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '삭제';
            deleteButton.classList.add('delete-button');
            deleteButton.addEventListener('click', () => {
                removeDomain(site);
            });

            listItem.appendChild(deleteButton);
            excludedSitesList.appendChild(listItem);
        });
    } else {
        const listItem = document.createElement('li');
        listItem.textContent = '제외할 사이트가 없습니다.';
        excludedSitesList.appendChild(listItem);
    }
}

/**
 * Chrome Storage에서 제외 사이트 목록을 불러와 렌더링하는 함수
 */
async function loadExcludedSites() {
    const result = await chrome.storage.sync.get([EXCLUDED_SITES_KEY]);
    const sites = result[EXCLUDED_SITES_KEY] || [];
    renderExcludedSites(sites);
    return sites; // 로드된 사이트 목록 반환
}

/**
 * 도메인을 제외 목록에 추가하는 함수
 */
async function addDomain() {
    let newDomain = domainInput.value.trim();
    if (!newDomain) {
        alert('제외할 사이트 도메인을 입력해주세요.');
        return;
    }

    // 간단한 유효성 검사 (URL 형태가 아니어도 도메인 자체일 수 있음)
    // 여기서는 간단히 공백만 아니면 추가하도록 함. 좀 더 정교한 검증은 필요에 따라 추가.
    // getDomainFromUrl 함수를 사용하여 입력값을 정제할 수도 있습니다.
    // 예: newDomain = getDomainFromUrl("http://" + newDomain) || newDomain;

    const result = await chrome.storage.sync.get([EXCLUDED_SITES_KEY]);
    const sites = result[EXCLUDED_SITES_KEY] || [];

    if (sites.includes(newDomain)) {
        alert('이미 목록에 있는 사이트입니다.');
    } else {
        sites.push(newDomain);
        await chrome.storage.sync.set({ [EXCLUDED_SITES_KEY]: sites });
        renderExcludedSites(sites);
        domainInput.value = ''; // 입력 필드 초기화
    }
}

/**
 * 도메인을 제외 목록에서 삭제하는 함수
 */
async function removeDomain(domainToRemove) {
    const result = await chrome.storage.sync.get([EXCLUDED_SITES_KEY]);
    let sites = result[EXCLUDED_SITES_KEY] || [];
    sites = sites.filter(site => site !== domainToRemove);
    await chrome.storage.sync.set({ [EXCLUDED_SITES_KEY]: sites });
    renderExcludedSites(sites);
}

// --- 버튼 이벤트 리스너 ---
/**
 * "추가" 버튼 클릭 이벤트
 */
addDomainButton.addEventListener('click', addDomain);
// 엔터 키로도 추가 가능하게
domainInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        addDomain();
    }
});


/**
 * "현재 사이트 사용" 버튼 클릭 이벤트
 */
useCurrentButton.addEventListener('click', async () => {
    try {
        // 현재 활성화된 탭의 정보를 가져옵니다.
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currentTab && currentTab.url) {
            const domain = getDomainFromUrl(currentTab.url);
            if (domain) {
                domainInput.value = domain;
            } else {
                alert('현재 탭의 URL에서 도메인을 추출할 수 없습니다.');
            }
        } else {
            alert('현재 활성화된 탭 정보를 가져올 수 없습니다.');
        }
    } catch (error) {
        console.error("Error getting current tab URL:", error);
        alert('현재 탭 정보를 가져오는 중 오류가 발생했습니다.');
    }
});

/**
 * "제외하고 검색" 버튼 클릭 이벤트
 */
searchButton.addEventListener('click', async () => {
    const keyword = keywordInput.value.trim();
    if (!keyword) {
        alert('검색어를 입력해주세요.');
        keywordInput.focus();
        return;
    }

    const sitesToExclude = await loadExcludedSites(); // 항상 최신 목록을 다시 로드
    let searchQuery = keyword;

    if (sitesToExclude && sitesToExclude.length > 0) {
        const excludeQuery = sitesToExclude.map(site => `-site:${site}`).join(' ');
        searchQuery += ` ${excludeQuery}`;
    }

    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    // 새 탭에서 검색 결과 열기
    chrome.tabs.create({ url: googleSearchUrl });
});
// 엔터 키로도 검색 가능하게
keywordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        searchButton.click(); // 검색 버튼 클릭 이벤트 트리거
    }
});


// --- 초기화 ---
// 팝업이 열릴 때 저장된 제외 사이트 목록을 불러와 화면에 표시
loadExcludedSites();