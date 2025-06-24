import json
import boto3
import os
import logging
logger = logging.getLogger() # loggerとは詳細な作業日誌（ログ）を残す機能
logger.setLevel(logging.INFO) # 日誌に「どのくらい重要な情報から書き始めるか」を設定する

def lambda_handler(event, context):

    #環境変数の取得
    ORIGINAL_BUCKET_NAME = os.environ.get('ORIGINAL_BUCKET_NAME')
    THUMBNAIL_BUCKET_NAME = os.environ.get('THUMBNAIL_BUCKET_NAME')
    PHOTO_TABLE_NAME = os.environ.get('PHOTO_TABLE_NAME')
    PICTURE_QUEUE_URL = os.environ.get('PICTURE_QUEUE_URL')
    results = []  # ← これを追加
    #「必要な設定情報がすべて揃っているかをチェックする」処理
    if not all([ORIGINAL_BUCKET_NAME, THUMBNAIL_BUCKET_NAME, PHOTO_TABLE_NAME, PICTURE_QUEUE_URL]):
       logger.error("Required environment variables are missing")
       return {
        'statusCode': 500,
        'body': json.dumps('Configuration error')
    }

    #AWSの各サービスを安全に使える準備
    try:
        s3 = boto3.client('s3')
        dynamodb = boto3.resource('dynamodb')
        sqs = boto3.client('sqs')
        table = dynamodb.Table(PHOTO_TABLE_NAME)


        #eventという「依頼書」の中から、「Records」という名前の項目を探して、その中身を取り出す処理。
        #「Records」という項目が存在しなかった場合、エラーになる代わりに、空のリスト[]を返します。
        for record in event.get('Records', []):
            try:
                # JSONメッセージの解析
                #photo_id = body['photo_id']だとKeyErrorの可能性があるためNoneが返されるように修正。
                body = json.loads(record['body'])
                photo_id = body.get('photo_id') 
                file_name = body.get('file_name')
                
                #写真を削除するために必要な情報（写真ID、ファイル名）がちゃんと揃っているかをチェック
                if not photo_id or not file_name:
                    logger.warning(f"Missing photo_id or file_name in record: {record}")
                    results.append({
                        'status': 'error',
                        'message': 'Missing photo_id or file_name'
                    })
                    continue

                try:
                    # logger.info~は削除したことを記録する」ログ出力
                    # S3ファイル削除（ファイル保存バケット）
                    s3.delete_object(Bucket=ORIGINAL_BUCKET_NAME, Key=file_name)
                    logger.info(f"Deleted from original bucket: {file_name}")
                    #S3ファイルの消去（サムネイルバケット）
                    s3.delete_object(Bucket=THUMBNAIL_BUCKET_NAME, Key=file_name)
                    logger.info(f"Deleted from thumbnail bucket: {file_name}")
                    #DynamoDBレコード削除
                    table.delete_item(Key={'photo_id': photo_id})
                    logger.info(f"Deleted from DynamoDB: {photo_id}")
                    # SQS通知（任意）
                    sqs.send_message(
                        QueueUrl=PICTURE_QUEUE_URL,
                        MessageBody=json.dumps({
                            'action': 'delete',
                            'photo_id': photo_id,
                            'file_name': file_name
                        })
                    )
                    logger.info(f"Sent SQS notification for: {photo_id}")

                    #「処理が成功したことを記録する」処理です。
                    results.append({
                        'status': 'success',
                        'photo_id': photo_id,
                        'file_name': file_name
                    })

                #ここからがよくわからん。
                except Exception as e:
                    logger.error(f"Error processing photo_id {photo_id}: {str(e)}")
                    results.append({
                        'status': 'error',
                        'photo_id': photo_id,
                        'file_name': file_name,
                        'error': str(e)
                    })


    except Exception as e:
        logger.error(f"Critical error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }

  # 処理結果の統計
    success_count = len([r for r in results if r.get('status') == 'success'])
    error_count = len([r for r in results if r.get('status') == 'error'])
    
    # 正常終了時のreturn（全ての処理が完了した後）
    return {
        'statusCode': 200 if error_count == 0 else 207,  # 部分的エラーの場合は207 Multi-Status
        'body': json.dumps({
            'message': 'Processing completed',
            'summary': {
                'total_processed': len(results),
                'successful': success_count,
                'failed': error_count
            },
            'results': results
        })
    }