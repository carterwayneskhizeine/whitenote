import os

# ================= 配置区域 =================
# 它会处理这个路径下的所有文件，以及所有子文件夹里的文件
TARGET_DIRECTORY = r'D:\Code\whitenote\data' 
# ===========================================

def fix_markdown_recursively(root_directory):
    if not os.path.exists(root_directory):
        print(f"错误: 找不到路径 '{root_directory}'")
        return

    count = 0
    # os.walk 会遍历整个目录树
    for dirpath, dirnames, filenames in os.walk(root_directory):
        for filename in filenames:
            if filename.endswith(".md"):
                # 拼接完整的文件路径
                file_path = os.path.join(dirpath, filename)
                
                try:
                    # 读取内容
                    with open(file_path, 'r', encoding='utf-8-sig') as f:
                        content = f.read()

                    # 检查开头是否有空白（换行或空格）
                    if content and content[0].isspace():
                        # lstrip() 移除开头所有空白，使 Tags 顶到第一行
                        new_content = content.lstrip()
                        
                        if new_content != content:
                            with open(file_path, 'w', encoding='utf-8') as f:
                                f.write(new_content)
                            # 打印相对路径，方便查看是哪个文件夹下的文件
                            relative_path = os.path.relpath(file_path, root_directory)
                            print(f"已修复: {relative_path}")
                            count += 1
                
                except Exception as e:
                    print(f"处理文件 {file_path} 时出错: {e}")

    print(f"\n处理完成！共在所有子目录中修复了 {count} 个文件。")

if __name__ == "__main__":
    fix_markdown_recursively(TARGET_DIRECTORY)