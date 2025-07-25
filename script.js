// Конфигурация Firebase (замените на свою)
const firebaseConfig = {
    apiKey: "AIzaSyAu_Fea9dcRVJ6E_P99ZfJWfopvCHUS-OA",
    authDomain: "photomap-7e448.firebaseapp.com",
    projectId: "photomap-7e448",
    storageBucket: "photomap-7e448.firebasestorage.app",
    messagingSenderId: "1062239241547",
    appId: "1:1062239241547:web:1183053cf718f74c2554ce"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

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

// Хранилище для фото
let photos = [];

// Аутентификация анонимного пользователя
auth.signInAnonymously()
    .then(() => loadPhotos())
    .catch(error => console.error("Auth error:", error));

// Загрузка фото из Firestore
function loadPhotos() {
    db.collection("photos").orderBy("timestamp", "desc")
        .onSnapshot(snapshot => {
            // Удаляем старые маркеры
            photos.forEach(photo => {
                if (photo.marker) map.removeLayer(photo.marker);
            });
            photos = [];
            photoList.innerHTML = '';
            
            // Добавляем новые фото
            snapshot.forEach(doc => {
                const photo = doc.data();
                addPhotoToMap(photo);
                addPhotoToList(photo);
                photos.push(photo);
            });
        });
}

// Обработчик загрузки фото
photoUpload.addEventListener('change', function(e) {
    const files = e.target.files;
    
    for (const file of files) {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const img = new Image();
            
            img.onload = function() {
                EXIF.getData(img, function() {
                    const exifData = EXIF.getAllTags(this);
                    
                    if (exifData?.GPSLatitude && exifData?.GPSLongitude) {
                        const lat = convertExifGps(exifData.GPSLatitude, exifData.GPSLatitudeRef);
                        const lon = convertExifGps(exifData.GPSLongitude, exifData.GPSLongitudeRef);
                        
                        savePhotoToFirestore({
                            lat: lat,
                            lon: lon,
                            url: event.target.result,
                            name: file.name,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
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

// Сохранение фото в Firestore
function savePhotoToFirestore(photo) {
    db.collection("photos").add(photo)
        .catch(error => console.error("Error adding photo:", error));
}

// Добавление фото на карту
function addPhotoToMap(photo) {
    const marker = L.marker([photo.lat, photo.lon], {
        riseOnHover: true
    }).addTo(map);
    
    marker.bindPopup(`
        <div class="photo-popup">
            <img src="${photo.url}" alt="${photo.name}">
            <p>Координаты: ${photo.lat.toFixed(6)}, ${photo.lon.toFixed(6)}</p>
        </div>
    `);
    
    photo.marker = marker;
}

// Добавление фото в список
function addPhotoToList(photo) {
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.innerHTML = `
        <img src="${photo.url}" alt="${photo.name}">
        <p>${photo.name}</p>
        <p>Координаты: ${photo.lat.toFixed(6)}, ${photo.lon.toFixed(6)}</p>
    `;
    
    photoItem.addEventListener('click', () => {
        map.setView([photo.lat, photo.lon], 15);
        photo.marker.openPopup();
        highlightPhotoItem(photoItem);
        
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
    });
    
    photoList.appendChild(photoItem);
}

// Подсветка выбранного фото
function highlightPhotoItem(item) {
    document.querySelectorAll('.photo-item').forEach(i => {
        i.style.background = 'white';
    });
    item.style.background = '#e6f7ff';
}

// Конвертация EXIF координат
function convertExifGps(coords, ref) {
    const degrees = coords[0] + coords[1]/60 + coords[2]/3600;
    return (ref === 'S' || ref === 'W') ? -degrees : degrees;
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