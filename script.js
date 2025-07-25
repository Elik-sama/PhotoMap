// Инициализация карты (центр - Екатеринбург)
const map = L.map('map').setView([56.845, 60.609], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Элементы DOM
const uploadButton = document.getElementById('upload-button');
const photoUpload = document.getElementById('photo-upload');
const photoList = document.getElementById('photo-list');
const menuButton = document.getElementById('menu-button');
const closeSidebar = document.getElementById('close-sidebar');
const sidebar = document.getElementById('sidebar');
const authButton = document.getElementById('auth-button');

// Хранилище для фото
let photos = [];
let googleAccessToken = null;
const FOLDER_NAME = "PhotoMap";
let folderId = null;

// Инициализация Google API
function initGoogleAPI() {
    gapi.load('client:auth2', async () => {
        await gapi.client.init({
            apiKey: 'AIzaSyB3PSacFD7k88wynsbSBLQgTLkg8-5eEsg',
            clientId: '375831769064-jsflqrvo30ntlae6avquaefmof203hui.apps.googleusercontent.com',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            scope: 'https://www.googleapis.com/auth/drive.file'
        });
        
        // Слушатель изменения статуса авторизации
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    });
}

// Обновление статуса авторизации
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        googleAccessToken = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
        authButton.textContent = "Выйти из Google";
        checkAndCreateFolder();
    } else {
        googleAccessToken = null;
        authButton.textContent = "Войти с Google";
    }
}

// Авторизация/выход
function handleAuth() {
    if (googleAccessToken) {
        gapi.auth2.getAuthInstance().signOut();
    } else {
        gapi.auth2.getAuthInstance().signIn();
    }
}

// Проверка и создание папки
async function checkAndCreateFolder() {
    try {
        // Поиск существующей папки
        const response = await gapi.client.drive.files.list({
            q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)'
        });
        
        if (response.result.files.length > 0) {
            folderId = response.result.files[0].id;
        } else {
            // Создание новой папки
            const folder = await gapi.client.drive.files.create({
                resource: {
                    name: FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            folderId = folder.result.id;
        }
        
        loadPhotosFromDrive();
    } catch (error) {
        console.error("Ошибка при работе с папкой:", error);
    }
}

// Обработчик загрузки фото
photoUpload.addEventListener('change', async function(e) {
    if (!googleAccessToken) {
        alert("Сначала войдите в Google Drive");
        return;
    }
    
    const files = e.target.files;
    
    for (const file of files) {
        const reader = new FileReader();
        
        reader.onload = async function(event) {
            const img = new Image();
            
            img.onload = function() {
                EXIF.getData(img, async function() {
                    const exifData = EXIF.getAllTags(this);
                    
                    if (exifData?.GPSLatitude && exifData?.GPSLongitude) {
                        const lat = convertExifGps(exifData.GPSLatitude, exifData.GPSLatitudeRef);
                        const lon = convertExifGps(exifData.GPSLongitude, exifData.GPSLongitudeRef);
                        
                        const photoData = {
                            lat: lat,
                            lon: lon,
                            image: event.target.result.split(',')[1], // base64 без префикса
                            name: file.name,
                            timestamp: new Date().toISOString()
                        };
                        
                        try {
                            await savePhotoToDrive(photoData);
                            addPhotoToUI(photoData);
                        } catch (error) {
                            console.error("Ошибка сохранения:", error);
                            alert("Не удалось сохранить фото");
                        }
                    } else {
                        alert(`Фото "${file.name}" не содержит геоданных!`);
                    }
                });
            };
            
            img.src = event.target.result;
        };
        
        reader.readAsDataURL(file);
    }
});

// Сохранение фото в Google Drive
async function savePhotoToDrive(photoData) {
    const metadata = {
        name: `photo_${Date.now()}.json`,
        mimeType: 'application/json',
        parents: [folderId]
    };

    const fileContent = JSON.stringify(photoData);
    
    const response = await gapi.client.drive.files.create({
        resource: metadata,
        media: {
            mimeType: 'application/json',
            body: fileContent
        },
        fields: 'id'
    });
    
    return response.result.id;
}

// Загрузка фото из Google Drive
async function loadPhotosFromDrive() {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
            orderBy: 'createdTime desc',
            fields: 'files(id,name)'
        });
        
        // Очистка текущих данных
        photos.forEach(photo => {
            if (photo.marker) map.removeLayer(photo.marker);
        });
        photos = [];
        photoList.innerHTML = '';
        
        // Загрузка каждого файла
        for (const file of response.result.files) {
            try {
                const fileResponse = await gapi.client.drive.files.get({
                    fileId: file.id,
                    alt: 'media'
                });
                
                const photo = fileResponse.result;
                photo.id = file.id; // Сохраняем ID файла для удаления
                addPhotoToUI(photo);
            } catch (error) {
                console.error(`Ошибка загрузки файла ${file.name}:`, error);
            }
        }
    } catch (error) {
        console.error("Ошибка загрузки фото:", error);
    }
}

// Добавление фото в интерфейс
function addPhotoToUI(photo) {
    // Восстанавливаем base64 изображение
    if (photo.image && !photo.url) {
        photo.url = `data:image/jpeg;base64,${photo.image}`;
    }
    
    // Добавляем на карту
    const marker = L.marker([photo.lat, photo.lon], {
        riseOnHover: true
    }).addTo(map);
    
    marker.bindPopup(`
        <div class="photo-popup">
            <img src="${photo.url}" alt="${photo.name}">
            <p>${photo.name}</p>
            <p>Координаты: ${photo.lat.toFixed(6)}, ${photo.lon.toFixed(6)}</p>
        </div>
    `);
    
    photo.marker = marker;
    
    // Добавляем в список
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.dataset.id = photo.id;
    
    photoItem.innerHTML = `
        <img src="${photo.url}" alt="${photo.name}">
        <div class="photo-info">
            <p>${photo.name}</p>
            <p>Координаты: ${photo.lat.toFixed(6)}, ${photo.lon.toFixed(6)}</p>
        </div>
        <button class="delete-photo" title="Удалить фото">×</button>
    `;
    
    // Обработчики событий
    photoItem.querySelector('.photo-info').addEventListener('click', () => {
        map.setView([photo.lat, photo.lon], 15);
        marker.openPopup();
        highlightPhotoItem(photoItem);
        
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
    });
    
    photoItem.querySelector('.delete-photo').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deletePhoto(photo.id, marker, photoItem);
    });
    
    photoList.appendChild(photoItem);
    photos.push(photo);
}

// Удаление фото
async function deletePhoto(fileId, marker, photoItem) {
    if (confirm('Вы уверены, что хотите удалить это фото?')) {
        try {
            await gapi.client.drive.files.delete({
                fileId: fileId
            });
            
            map.removeLayer(marker);
            photoItem.remove();
            
            // Удаляем из массива photos
            photos = photos.filter(p => p.id !== fileId);
        } catch (error) {
            console.error("Ошибка удаления:", error);
            alert("Не удалось удалить фото");
        }
    }
}

// Вспомогательные функции
function convertExifGps(coords, ref) {
    const degrees = coords[0] + coords[1]/60 + coords[2]/3600;
    return (ref === 'S' || ref === 'W') ? -degrees : degrees;
}

function highlightPhotoItem(item) {
    document.querySelectorAll('.photo-item').forEach(i => {
        i.style.background = 'white';
    });
    item.style.background = '#e6f7ff';
}

// Управление боковой панелью
menuButton.addEventListener('click', () => {
    sidebar.classList.add('active');
});

closeSidebar.addEventListener('click', () => {
    sidebar.classList.remove('active');
});

map.on('click', () => {
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.add('active');
    } else {
        sidebar.classList.remove('active');
    }
});

// Инициализация при загрузке
window.onload = function() {
    initGoogleAPI();
    authButton.addEventListener('click', handleAuth);
};