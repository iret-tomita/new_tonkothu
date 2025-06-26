/**************************************************/
/* 1) API エンドポイント設定                      */
/**************************************************/

const apiUploadEndpoint = "https://6je5ay7ocb.execute-api.ap-northeast-1.amazonaws.com/First/upload";

const apiGetPhotosEndpoint = "https://6je5ay7ocb.execute-api.ap-northeast-1.amazonaws.com/First/get";

const apiDeleteEndpoint = "https://6je5ay7ocb.execute-api.ap-northeast-1.amazonaws.com/First/delete";

const apiLikeEndpoint = "";

/**************************************************/
/* 2) 変数・定数                                  */
/**************************************************/
let isFetching = false; // サムネイル取得中のフラグ
let lastFetchTime = 0;  // 最終サムネイル取得時刻（連打防止用）

/**************************************************/
/* 3) 写真アップロード処理                        */
/**************************************************/
async function handlePhotoUpload() {
  const fileInput = document.getElementById("photoInput");
  const uploadButton = document.getElementById("uploadButton");
  const file = fileInput.files[0];

  if (!file) {
    alert("ファイルを選択してください");
    resetUploadUI(); // ファイルがない場合もUIを初期状態に戻す
    return;
  }

  // アップロードボタンを無効化（処理中を示すため）
  uploadButton.disabled = true;
  // ボタンテキストを処理中表示に変更（Font AwesomeのアイコンはCSSで代替するか、HTMLから削除）
  const originalButtonHtml = uploadButton.innerHTML; // 元のHTMLを保存
  uploadButton.textContent = "アップロード中..."; // テキストのみ変更

  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageData = e.target.result;
    try {
      const response = await fetch(apiUploadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: imageData.split(",")[1], // "data:image/jpeg;base64," の部分を除去
          original_filename: file.name,
        }),
      });

      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.statusText}`);
      }
      alert("アップロード成功！");

      // リスト再取得を少し遅らせる（サムネイル生成完了を待つため）
      setTimeout(() => {
        fetchThumbnails();
      }, 2000);

      resetUploadUI(); // UIを初期状態にリセット

    } catch (error) {
      console.error("アップロードエラー:", error);
      alert("アップロードに失敗しました。\n" + error.message); // エラーメッセージを表示
      resetUploadUI(); // エラー時もUIを初期状態にリセット
    } finally {
      // 処理が完了したら、ボタンのテキストを元に戻す
      uploadButton.innerHTML = originalButtonHtml;
    }
  };
  reader.readAsDataURL(file); // ファイルをBase64データURIとして読み込む
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
      throw new Error(`サーバーエラー: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("GET /photos レスポンス:", data);

    // data.thumbnails = [ { photo_id, thumbnail_url, original_url, likes }, ... ] と想定
    if (!data.thumbnails || data.thumbnails.length === 0) {
      console.warn("DynamoDBからのサムネイルデータが空です");
      updatePhotoGrid([]); // 一覧をクリア
      return;
    }

    updatePhotoGrid(data.thumbnails);
  } catch (error) {
    console.error("サムネイル一覧の取得エラー:", error);
    alert("写真一覧の取得に失敗しました。\n" + error.message);
  } finally {
    isFetching = false;
  }
}

/**************************************************/
/* 5) 写真をグリッドに追加                        */
/**************************************************/
function updatePhotoGrid(photos) {
  const photoGrid = document.getElementById("photoGrid");
  photoGrid.innerHTML = ""; // 既存の要素をクリア

  photos.forEach((photo) => { // indexは不要なので削除
    const photoItem = document.createElement("div");
    photoItem.className = "photo-item";

    // --- 画像コンテナと画像要素 ---
    const imgContainer = document.createElement("div");
    imgContainer.className = "photo-item-image-container"; // CSSで定義するクラス

    const img = document.createElement("img");
    img.src = photo.thumbnail_url; // サムネイルURLを使用
    img.alt = "投稿された写真";
    img.addEventListener("click", () => showModal(photo.original_url)); // クリックで拡大表示
    imgContainer.appendChild(img);

    // --- アクションバー ---
    const actionBar = document.createElement("div");
    actionBar.className = "action-bar";

    // --- いいね関連 ---
    const likeContainer = document.createElement("div");
    likeContainer.className = "like-container";

    const likeButton = document.createElement("button");
    // いいねアイコンの初期状態 (Font AwesomeをHTML側で使用しないため、👍マークを使用)
    // 💡 Font Awesomeを再度使う場合は、HTMLの<link>を有効化し、`<i>`タグに`fas fa-thumbs-up`クラスを付与
    likeButton.innerHTML = '<span class="like-icon">👍</span>'; // HTMLエンティティまたはFont Awesomeアイコン

    likeButton.className = "like-button";
    if (!photo.photo_id) { // photo_idがない場合は無効化
      likeButton.disabled = true;
    } else {
      
      if (photo.likes && photo.likes > 0) {
          likeButton.querySelector('.like-icon').classList.add('liked');
      }

      likeButton.addEventListener("click", (event) => {
        event.stopPropagation(); // 親要素（画像）へのクリックイベント伝播を停止
        handleLike(photo.photo_id, likeButton); // photo_idとボタン要素を渡す
      });
    }

    const likeCountEl = document.createElement("span");
    likeCountEl.id = `likeCount-${photo.photo_id}`;
    likeCountEl.className = "like-count";
    likeCountEl.textContent = photo.likes != null ? photo.likes : 0; // nullの場合は0を表示

    likeContainer.appendChild(likeButton);
    likeContainer.appendChild(likeCountEl);

    // --- 削除ボタン ---
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.className = "delete-button"; // CSSで赤色を定義
    if (!photo.photo_id) { // photo_idがない場合は無効化
      deleteButton.disabled = true;
    } else {
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation(); // 親要素（画像）へのクリックイベント伝播を停止
        deletePhoto(photo.photo_id);
      });
    }

    // --- アクションバーに要素を追加 ---
    actionBar.appendChild(likeContainer);
    actionBar.appendChild(deleteButton);

    // --- photoItemに全てを追加 ---
    photoItem.appendChild(imgContainer);
    photoItem.appendChild(actionBar);

    photoGrid.appendChild(photoItem);
  });
}

/**************************************************/
/* 6) 個別写真削除処理                             */
/**************************************************/
async function deletePhoto(photo_id) {
  if (!confirm("この写真を削除してよろしいですか？")) {
    return;
  }
  try {
    // API GatewayのURLにphoto_idをパスとして含める
    const response = await fetch(`${apiDeleteEndpoint}${photo_id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`サーバーエラー: ${response.statusText}`);
    }
    alert("写真を削除しました");
    fetchThumbnails(); // 削除後、一覧を再取得
  } catch (error) {
    console.error("削除エラー:", error);
    alert("削除に失敗しました。\n" + error.message);
  }
}

/**************************************************/
/* 7) いいねボタン (POST /photos/{photo_id}/like) */
/**************************************************/
async function handleLike(photo_id, buttonElement) {
  try {
    // API GatewayのURLにphoto_idをパスとして含める
    const response = await fetch(`${apiLikeEndpoint}${photo_id}/like`, { // "/like" パスを追加
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`サーバーエラー: ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Like updated:", data);

    const likeCountEl = document.getElementById(`likeCount-${photo_id}`);
    if (likeCountEl) {
      // APIからのレスポンスに含まれるlikes数で更新
      likeCountEl.textContent = data.likes != null ? data.likes : 0;
    }

    // いいね成功時、ボタンのアイコンを黄色に変更
    const likeIcon = buttonElement.querySelector('.like-icon');
    if (likeIcon) {
        likeIcon.classList.add('liked'); // likedクラスを追加
    }

  } catch (error) {
    console.error("いいね失敗:", error);
    alert("いいねに失敗しました。\n" + error.message);
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
  modalContainer.style.display = "flex"; // モーダルを表示
}

// 「X」ボタンでモーダル閉じる
modalCloseBtn.addEventListener("click", () => {
  modalContainer.style.display = "none";
  modalImg.src = ""; // 画像ソースをクリア
});

// 背景クリックでも閉じる
modalContainer.addEventListener("click", (e) => {
  if (e.target === modalContainer) { // モーダルの背景部分がクリックされた場合のみ
    modalContainer.style.display = "none";
    modalImg.src = ""; // 画像ソースをクリア
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

    // メインのアップロードボタンのテキストを「アップロード」に戻す（処理中から戻る場合）
    uploadButton.textContent = "アップロード"; // テキストのみ変更
    
    // 「＋ 写真を選択」ボタンは、ファイル選択後に表示しておく（ユーザーがファイルを変更できるように）
    selectPhotoButton.classList.remove("hidden-element"); 
    selectPhotoButton.disabled = false; // 「＋ 写真を選択」ボタンを有効に
  } else {
    // ファイル選択がキャンセルされた場合など
    resetUploadUI();
  }
});

// アップロードボタンがクリックされたらファイル選択ダイアログを開く、またはアップロード処理を開始
uploadButton.addEventListener("click", () => {
    // ファイルが選択済みの場合、アップロード処理を開始
    if (photoInput.files.length > 0) {
        handlePhotoUpload();
    } else {
        // ファイルが未選択の場合、「＋ 写真を選択」ボタンと同じ動作でファイル選択ダイアログを開く
        photoInput.click();
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
  // アップロードボタンのテキストを元に戻す
  uploadButton.textContent = "アップロード";

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