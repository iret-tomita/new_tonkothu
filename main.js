/**************************************************/
/* 1) API エンドポイント設定                      */
/**************************************************/
const apiUploadEndpoint = "https://6je5ay7ocb.execute-api.ap-northeast-1.amazonaws.com/UPLOAD"; // TODO: 実際のAPIエンドポイントに置き換える
const apiGetPhotosEndpoint = "https://6je5ay7ocb.execute-api.ap-northeast-1.amazonaws.com/GET_FULL"; // TODO: 実際のAPIエンドポイントに置き換える
// const apiDeleteEndpoint = "APIGatewayエンドポイント";
// const apiLikeEndpoint = "APIGatewayエンドポイント";

/**************************************************/
/* 2) 変数・定数                                  */
/**************************************************/
let isFetching = false;
let lastFetchTime = 0;

/**************************************************/
/* 3) 写真アップロード処理                        */
/**************************************************/
async function handlePhotoUpload() {
  const fileInput = document.getElementById("photoInput");
  const uploadButton = document.getElementById("uploadButton");
  const selectedFileDisplay = document.getElementById("selectedFileDisplay");
  const selectedFileNameSpan = document.getElementById("selectedFileName");
  const file = fileInput.files[0];

  if (!file) {
    alert("ファイルを選択してください");
    resetUploadUI(); // ファイルがない場合もUIを初期状態に戻す
    return;
  }

  // アップロードボタンを無効化（処理中を示すため）
  uploadButton.disabled = true;
  // ボタンテキストとアイコンを処理中表示に変更
  const originalButtonHtml = uploadButton.innerHTML; // 元のHTMLを保存
  uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> アップロード中...';


  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageData = e.target.result;
    try {
      const response = await fetch(apiUploadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: imageData.split(",")[1],
          original_filename: file.name,
        }),
      });

      if (!response.ok) {
        throw new Error("アップロードに失敗しました");
      }
      alert("アップロード成功！");

      // リスト再取得を少し遅らせる
      setTimeout(() => {
        fetchThumbnails();
      }, 2000);

      resetUploadUI(); // UIを初期状態にリセット

    } catch (error) {
      console.error("アップロードエラー:", error);
      alert("アップロードに失敗しました。");
      resetUploadUI(); // エラー時もUIを初期状態にリセット
    } finally {
      // finallyブロックでは、ボタンの表示状態は resetUploadUI() で処理されるため、
      // ここでは元のHTMLに戻す必要はありません。
      // もし resetUploadUI() を呼び出さないパスがある場合のために残すことも検討
      // uploadButton.disabled = false;
      // uploadButton.innerHTML = originalButtonHtml;
    }
  };
  reader.readAsDataURL(file);
}

/**************************************************/
/* 4) 画像一覧取得処理（DynamoDBから取得）         */
/**************************************************/
async function fetchThumbnails() {
  const now = Date.now();
  // 5秒以内の連打を防止
  if (isFetching || now - lastFetchTime < 5000) {
    console.warn("リクエスト頻度が高いためスキップ");
    return;
  }
  isFetching = true;
  lastFetchTime = now;

  try {
    const response = await fetch(apiGetPhotosEndpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error("サーバーエラー");
    }

    const data = await response.json();
    console.log("GET /photos レスポンス:", data);

    // data.thumbnails = [ { photo_id, thumbnail_url, likes }, ... ] と想定
    if (!data.thumbnails || data.thumbnails.length === 0) {
      console.warn("DynamoDBからのサムネイルデータが空です");
      updatePhotoGrid([]); // 一覧をクリア
      return;
    }

    updatePhotoGrid(data.thumbnails);
  } catch (error) {
    console.error("サムネイル一覧の取得エラー:", error);
  } finally {
    isFetching = false;
  }
}

/**************************************************/
/* 5) 写真をグリッドに追加 (削除ボタン右側配置)   */
/**************************************************/
function updatePhotoGrid(photos) {
  const photoGrid = document.getElementById("photoGrid");
  photoGrid.innerHTML = "";

  photos.forEach((photo, index) => {
    console.log(`photo #${index}:`, photo);

    const photoItem = document.createElement("div");
    photoItem.className = "photo-item";

    // 画像
    const img = document.createElement("img");
    img.src = photo.thumbnail_url;
    img.alt = "投稿された写真";

    // 画像クリック -> モーダル拡大表示
    img.addEventListener("click", () => showModal(photo.original_url));

    // アクションバー
    const actionBar = document.createElement("div");
    actionBar.className = "action-bar";

    //いいね関連
    
    const likeContainer = document.createElement("div");
    likeContainer.className = "like-container";

    const likeButton = document.createElement("button");
    likeButton.textContent = "👍";
    likeButton.className = "like-button";
    if (!photo.photo_id) {
      likeButton.disabled = true;
    } else {
      likeButton.addEventListener("click", () => handleLike(photo.photo_id));
    }

    const likeCountEl = document.createElement("span");
    likeCountEl.id = `likeCount-${photo.photo_id}`;
    likeCountEl.className = "like-count";
    likeCountEl.textContent = photo.likes != null ? photo.likes : 0;

    likeContainer.appendChild(likeButton);
    likeContainer.appendChild(likeCountEl);
    

    // 削除ボタン 
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.className = "delete-button";
    if (!photo.photo_id) {
      deleteButton.disabled = true;
    } else {
      deleteButton.addEventListener("click", () => deletePhoto(photo.photo_id));
    }
  

    // actionBar.appendChild(likeContainer);
    // actionBar.appendChild(deleteButton);

    photoItem.appendChild(img);
    photoItem.appendChild(actionBar);

    photoGrid.appendChild(photoItem);
  });
}

/**************************************************/
/* 6) 個別写真削除処理 (コメントアウトされたまま) */
/**************************************************/
/*
async function deletePhoto(photo_id) {
  if (!confirm("この写真を削除してよろしいですか？")) {
    return;
  }
  try {
    const response = await fetch(apiDeleteEndpoint + photo_id, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("サーバーでエラーが発生しました");
    }
    alert("写真を削除しました");
    fetchThumbnails();
  } catch (error) {
    console.error("削除エラー:", error);
    alert("削除に失敗しました");
  }
}
*/

/**************************************************/
/* 7) いいねボタン (POST /photos/{photo_id}/like) 
/**************************************************/

async function handleLike(photo_id) {
  try {
    const response = await fetch(`${apiLikeEndpoint}${photo_id}/like`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to like photo");
    }
    const data = await response.json();
    console.log("Like updated:", data);

    const likeCountEl = document.getElementById(`likeCount-${photo_id}`);
    if (likeCountEl) {
      likeCountEl.textContent = data.likes;
    }
  } catch (error) {
    console.error("いいね失敗:", error);
    alert("いいねに失敗しました");
  }
}


/**************************************************/
/* 8) 拡大表示 (モーダル)                         */
/**************************************************/
const modalContainer = document.getElementById("modalContainer");
const modalContent = document.getElementById("modalContent");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalImg = document.getElementById("modalImg");

// サムネイルをクリック → showModal
function showModal(imageUrl) {
  if (!imageUrl) {
    console.warn("showModal called with empty URL");
    return;
  }
  modalImg.src = imageUrl;
  modalContainer.style.display = "flex";
}

// 「X」ボタンでモーダル閉じる
modalCloseBtn.addEventListener("click", () => {
  modalContainer.style.display = "none";
  modalImg.src = "";
});

// 背景クリックでも閉じる
modalContainer.addEventListener("click", (e) => {
  if (e.target === modalContainer) {
    modalContainer.style.display = "none";
    modalImg.src = "";
  }
});

/**************************************************/
/* 9) イベントリスナー＋リロード時のモーダル非表示 */
/**************************************************/
const photoInput = document.getElementById("photoInput");
const selectPhotoButton = document.getElementById("selectPhotoButton");
const selectedFileDisplay = document.getElementById("selectedFileDisplay");
const selectedFileNameSpan = document.getElementById("selectedFileName");
const uploadButton = document.getElementById("uploadButton"); // アップロードボタン
const clearSelectionButton = document.getElementById("clearSelectionButton"); // 「×」ボタン

// アップロードボタンがクリックされたらファイル選択ダイアログを開く
uploadButton.addEventListener("click", () => {
    // アップロードボタンが有効な場合のみ、ファイル選択ダイアログを開く
    // （ファイル選択済みで「アップロード」として機能している時は、そのままhandlePhotoUploadへ）
    if (!uploadButton.disabled && photoInput.files.length === 0) {
        photoInput.click();
    } else if (photoInput.files.length > 0) {
        // ファイルが選択済みの場合は、そのままアップロード処理を開始
        handlePhotoUpload();
    }
});

// 「＋ 写真を選択」ボタンがクリックされたら、隠れたinput要素をクリック
selectPhotoButton.addEventListener("click", () => {
  photoInput.click();
});

// ファイルが選択されたら、UIの表示を切り替える
photoInput.addEventListener("change", () => {
  if (photoInput.files.length > 0) {
    selectedFileNameSpan.textContent = photoInput.files[0].name;
    selectedFileDisplay.classList.remove("hidden-element"); // ファイル名表示エリアを表示
    uploadButton.classList.remove("hidden-element"); // アップロードボタンを表示
    uploadButton.disabled = false; // アップロードボタンを有効化

    // メインのアップロードボタンのテキストとアイコンを「アップロード」に戻す（処理中から戻る場合）
    uploadButton.innerHTML = '<i class="fas fa-camera"></i> アップロード';

    // 「＋ 写真を選択」ボタンは、ファイル選択後に表示しておく（ユーザーがファイルを変更できるように）
    selectPhotoButton.classList.remove("hidden-element"); 
    selectPhotoButton.disabled = false; // 「＋ 写真を選択」ボタンを有効に
  } else {
    // ファイル選択がキャンセルされた場合など
    resetUploadUI();
  }
});

// 「×」ボタンがクリックされたら、選択を解除してUIをリセット
clearSelectionButton.addEventListener("click", () => {
  resetUploadUI();
});

// UIを初期状態に戻すヘルパー関数
function resetUploadUI() {
  photoInput.value = ""; // ファイル選択をクリア
  selectedFileNameSpan.textContent = ""; // ファイル名表示をクリア
  selectedFileDisplay.classList.add("hidden-element"); // ファイル名表示エリアを隠す
  
  // アップロードボタンは初期状態では隠れていて、ファイル選択後に表示される
  uploadButton.classList.add("hidden-element"); // アップロードボタンを隠す
  uploadButton.disabled = true; // アップロードボタンを無効にする
  // アップロードボタンのテキストとアイコンを元に戻す
  uploadButton.innerHTML = '<i class="fas fa-camera"></i> アップロード';

  // 「＋ 写真を選択」ボタンのみを表示
  selectPhotoButton.classList.remove("hidden-element"); // 表示
  selectPhotoButton.disabled = false; // 有効に
}


window.addEventListener("DOMContentLoaded", () => {
  // ページ読み込み時にモーダルを必ず閉じておく
  modalContainer.style.display = "none";
  modalImg.src = "";

  // 写真一覧を読み込む
  fetchThumbnails();

  // 初期状態でアップロードUIをリセット（「＋ 写真を選択」のみ表示）
  resetUploadUI();
});