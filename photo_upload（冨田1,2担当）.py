import json
import boto3
import os
import uuid
import base64
import os.path

# --- AWS クライアント/リソースの初期化 ---
#写真をブラウザからアップロードしたい。


def lambda_handler(event, context):
    # --- (1) 環境変数の読み込み ---

    BUCKET_NAME = os.environ['main-picture-bucket-<userT01>'] # 元画像が入っているS3バケット
    THUMBNAIL_BUCKET_NAME = os.environ['thumbnail_picture'] # サムネイルを保存するS3バケット
    PHOTO_TABLE_NAME = os.environ['picture_table'] # DynamoDBテーブル名

    # --- (2) リクエストデータの解析 ---
    #     API Gateway等を通じて、'body'にJSON文字列が入っている想定

    # Webリクエストの本体（JSON形式の文字列）をPythonの辞書に変換し、そこから"画像データ"と"元のファイル名"を安全に取り出す

    body = json.loads(event['body'])
    image_data = body.get('imageData')
    #元のデータをbodyと解析していて、サムネのデータをimage_dateと解析している。

    original_filename = body.get('original_filename', '')  
    #bodyのファイル名を"original_filename"と解析している？
    
    # フロントから送ってもらう


    # --- (3) ファイル拡張子の取得 ---
    #     拡張子が無い場合、あるいはファイル名空の場合などを考慮
    _, ext = os.path.splitext(original_filename)
    ext = ext.lower() if ext else ".jpg"  # 拡張子が無い場合は .jpg
    if not ext.startswith('.'):
        ext = '.' + ext

    # --- (4) ユニークなファイル名を生成 ---
    #     例: "451b8413-6b47-4c8b-a3dc-9c1a3f9a5f3e.jpg"
    #photo_id = 
    file_name = f"{photo_id}{ext}"

    # --- (5) Base64 -> バイナリデコード ---
    binary_image = base64.b64decode(image_data)

    # --- (6) S3にファイルをアップロード ---
    
        
        
        
    

    # --- (7) SQSメッセージ送信 (次の処理を行うサービスへ通知) ---
    #     photo_id と S3にアップロードしたファイル名を含むメッセージを送る
    
        
        
    

    # --- (8) レスポンスを返す ---
    return {
        
        
        
            
            
        
    }