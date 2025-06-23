import json
import boto3
import os
import uuid
import base64
import os.path

def lambda_handler(event, context):
    try:
        # --- (1) 環境変数の読み込み ---
        ORIGINAL_BUCKET_NAME = os.environ['main_picture_bucket']
        PHOTO_TABLE_NAME  = os.environ['picture_table']
        PICTURE_QUEUE_URL = os.environ['SQSキューのURL']
        s3 = boto3.client('s3')

        # --- (2) リクエストデータの解析 ---
        body = json.loads(event['body'])
        image_data = body.get('imageData')
        original_filename = body.get('original_filename', '')

        if not image_data or not original_filename:
            return {
                'statusCode': 400,
                'body': json.dumps('Missing imageData or original_filename')
            }

        # --- (3) ファイル拡張子の取得 ---
        _, ext = os.path.splitext(original_filename)
        ext = ext.lower() if ext else ".jpg"
        if not ext.startswith('.'):
            ext = '.' + ext

        # --- (4) ユニークなファイル名を生成 ---
        photo_id = str(uuid.uuid4())
        file_name = f"{photo_id}{ext}"

        # --- (5) Base64 -> バイナリデコード ---
        binary_image = base64.b64decode(image_data)

        # --- (6) S3にファイルをアップロード ---
        s3.put_object(
            Bucket= ORIGINAL_BUCKET_NAME,
            Key=file_name,
            Body=binary_image,
            ContentType='image/jpeg'
        )

        # --- (7) SQSメッセージ送信 ---
        sqs = boto3.client('sqs')
        message = {
            'photo_id': photo_id,
            'file_name': file_name
        }
        sqs.send_message(
            QueueUrl=PICTURE_QUEUE_URL,
            MessageBody=json.dumps(message)
        )

        # --- (8) レスポンスを返す ---
        return {
            'statusCode': 200,
            'body': json.dumps(f'{file_name} uploaded to {BUCKET_NAME}')
        }

    except Exception as e:
        # --- (9) 例外時のレスポンス ---
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }
